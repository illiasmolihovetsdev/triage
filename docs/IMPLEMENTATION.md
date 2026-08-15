# Triage — Implementation

What the running system actually does today, and why it is built this way.

`ARCHITECTURE.md` is the forward-looking design document and still contains open
questions. This document is the opposite: it describes only what is implemented
and verified. If the two disagree, this one is right, and the architecture
document needs updating.

Everything below reflects the state of the project through the atomic claim
endpoint. The queue UI does not yet claim, so R1 is not finished. Resolve,
release, and R3 are not implemented yet.

## 1. Project structure

```
src/
  app/          routes, layouts, and Route Handlers
  components/   one folder per component
  hooks/        stateful logic shared by more than one component
  services/     everything that talks to a data source
  lib/          infrastructure primitives (database, session, authorization)
  types/        types shared across folders
  utils/        pure helpers shared across folders
```

A component folder holds `index.tsx` plus, as needed, `types.ts` for its props,
`hooks.ts` for state, and `utils.ts` for pure helpers. The component file
renders; it does not fetch and it does not shape data. A local file is promoted
to `src/hooks/` or `src/utils/` as soon as a second component needs it, so no
component ever imports another component's internals.

The shape is the same at every level, so there is only one convention to learn:
a component is a folder whose component file is `index.tsx`. A top-level folder
is reserved for a component with more than one consumer; one that only ever
renders inside a single parent nests inside it.
The counterweight is that a single styled element used once is not a component
at all — a folder per `<p>` produces a tree that is technically well-organized
and practically unreadable.

`src/services/` is the only place that talks to a data source, which keeps a
change to an endpoint or a query in one file instead of scattered through the
component tree:

- `services/auth/` makes browser-to-server calls.
- `services/users/` queries the database and begins with `import 'server-only'`.
- `services/items/` and `services/memberships/` load the rows authorization
  needs, and `services/items/` also loads the capped queue page.

That import is a guard rather than decoration. Importing a database module from
a client component becomes a build error instead of a bundle that quietly ships
Prisma, and the connection string, to the browser.

Services return an explicit result — `{ isSuccess: true }` or
`{ isSuccess: false, errorMessage }` — rather than throwing, so a caller cannot
ignore failure by omitting a `try`/`catch` it never thought about.

Types live in `types.ts` files, never inline in a `.tsx` file. `WorkspaceRole`
is derived from the generated Prisma enum as `Lowercase<Role>`, so adding a role
to the schema becomes a type error in the UI layer rather than a union that
silently drifts from the database.

## 2. Database invariants

The schema keeps its most important invariants in PostgreSQL rather than in
application code. The `CHECK` constraints are written by hand in
`prisma/migrations/20260813170000_init/migration.sql`, because Prisma's schema
language cannot express them:

- An item's `status` must agree with its claim columns. `PENDING` has no
  claimant and no timestamps; `CLAIMED` has both a claimant and a claim time and
  no resolution; `RESOLVED` has all three. A partially written claim cannot be
  stored, whatever the calling code does.
- A notification attempt that is `SENT` or `FAILED` must record `finishedAt`;
  one still `PENDING` must not. A `FAILED` attempt must carry an error message
  and a successful one must not.
- `NotificationAttempt.itemId` is unique, so resolving an item cannot produce
  two attempt records.

The point of putting these in the database is that they hold for every writer.
A bug in a Route Handler, a mistaken `prisma studio` edit, or a hand-written SQL
fix all hit the same wall.

## 3. Row level security

Row level security is enabled on every table, with no policies defined.

Supabase publishes the `public` schema through PostgREST. Without RLS, anyone
holding the project's publishable key could read and write items directly,
completely bypassing this application's authorization. With RLS on and no
policies, that path is denied by default.

The application is unaffected: it connects as the table-owning `postgres` role,
which bypasses RLS. So this closes the REST door without moving authorization
into database policies — authorization stays in server-side application code,
where it can be read, tested, and reasoned about in one place.

## 4. Authentication

There is no OAuth, by design; the assignment asks for seeded-user selection. The
home page lists the seeded users, and signing in as one sets a session cookie.
Signing in as the user who already owns the session is rejected: the Sign in
button for that row is disabled, and `POST /api/auth/login` returns 409 if the
request still arrives. Switching to a different seeded user is still allowed.

What matters is that the identity cannot be edited after the fact:

- The cookie holds a JWT signed with `AUTH_SECRET` (HS256), not a bare user ID.
- It is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Verification pins the algorithm to HS256, so a token claiming `alg: none` is
  rejected rather than accepted unverified.

The session carries only the user ID. Roles and workspace membership are read
from the database at the point where they are enforced and never stored in the
cookie, so a session cannot outlive or contradict the current membership rows.
Revoking a role takes effect on the next request rather than whenever the cookie
happens to expire.

`src/lib/session.ts` deliberately imports neither Next.js nor Prisma. That is
what lets `src/lib/session.test.ts` test the token rules directly, including
tampering with the payload, tampering with the signature, expiry, a wrong
secret, and the `alg: none` case.

## 5. Seed data

`npm run seed` clears the tables and rebuilds them, so it is safe to re-run. It
prints the accounts it created rather than committing them to a document that
can fall out of step with the script.

It creates two workspaces, six users, and 10,000 items.

Two workspaces exist so cross-workspace access can genuinely be tested: a user
in one workspace has a real item ID in the other to attack with. The roles cover
one viewer, so R2's read-only restriction has a subject.

Items are split roughly 8,600 to one workspace and 1,400 to the other, with a
deliberately uneven status spread of about 68% pending, 12% claimed, and 20%
resolved. An even split would flatter the queue: it is the large pending backlog
that makes paging and filtering behave realistically.

Every resolved item carries a notification record whose outcomes mirror the
failure rate the application has to live with — roughly 78% sent, 17% failed,
and a few left pending to represent attempts whose result was never recorded.

Claimants are always non-viewer members of the item's own workspace, so the
seeded rows never contradict the rules the application enforces, and never
violate the `CHECK` constraints above.

The 10,000 items are inserted by a single `generate_series` statement rather
than ten thousand round trips. One subtlety worth recording: `random()` in an
uncorrelated `CROSS JOIN LATERAL` is evaluated once for the whole statement, so
the first version of this script produced 10,000 identical statuses. The fix was
`MATERIALIZED` CTEs, which force per-row evaluation.

## 6. Authorization

Every protected item operation will go through `requireItemAction` in
`src/lib/authz.ts`. Queue listing goes through `requireCallerMembership` in the
same file. There are no item mutation routes yet.

The check is:

1. Resolve the caller from the signed cookie. No user → **401**.
2. Load the item by ID. The workspace comes from that row, never from a
   client-supplied workspace ID. Unknown item → **404**.
3. Load membership for `(userId, item.workspaceId)`. No row → **404**, the same
   body as an unknown item, so a stolen ID from another workspace does not
   confirm that the item exists.
4. Check the role against the action. A viewer may `read` and nothing else.
   Owners and members may `read`, `claim`, `resolve`, and `release`. Failure →
   **403**.
5. `resolve` and `release` also require `item.claimedById === caller.id`. Owners
   do not override this. Failure → **403** with code `NOT_CLAIMER`.

The role matrix and the 401/403/404 distinction are a pure function in
`src/utils/authorization.ts`. `requireItemAction` only loads the three facts
that function needs (user, item, membership) and asks it. That split is what
lets the matrix be tested without a request or a database, which is the part
most likely to be implemented incorrectly: mixing "you may not" with "this item
is not here" would leak existence to anyone who can paste an ID into curl.

The UI may later hide buttons using `canRolePerformAction`. That is display
only. Curl still has to pass through `requireItemAction`.

## 7. Queue listing

`/queue` is a Server Component. It does not read a workspace ID from the URL,
the query string, or the body. `requireCallerMembership` loads the caller's
memberships from the cookie identity and accepts the request only when there is
exactly one. Zero or more than one is **403**: guessing a workspace on the
server is the same class of mistake as trusting one from the client.

The page then loads at most 50 items, newest first (`createdAt`, then `id`).
That cap is a guard so 10,000 rows never reach the response. It is not
pagination: there is no next page, and the heading says how many were shown
out of how many exist so the limit is visible.

Unauthenticated visits redirect to `/` from the queue layout, before
`loading.tsx` can render. Signing in navigates to `/queue`. Signing out
navigates to `/`. A viewer sees the same table as a member; there are no
action buttons yet, so the role difference is not visible in the UI.
Isolation is: Alice's queue titles start with `Support`, Erin's with `Billing`.

## 8. Concurrent claiming

`POST /api/items/[id]/claim` is the first item mutation. It calls
`requireItemAction(itemId, 'claim')` and only then runs one conditional update:

```sql
UPDATE "Item"
SET status = 'CLAIMED', "claimedById" = $userId, "claimedAt" = now()
WHERE id = $itemId AND status = 'PENDING'
```

Prisma `updateMany` with `where: { id, status: 'PENDING' }` compiles to that
statement. PostgreSQL locks the row, evaluates `WHERE`, and applies at most one
of the concurrent updates. That is the R1 guarantee — not an application-level
`if` after a read.

The loser matches zero rows, reads who holds the item now, and receives **409**
`CLAIM_CONFLICT` with `{ claimedBy: { id, name } }`. The follow-up read is not
the winning snapshot: if the winner has already released and someone else
claimed, the 409 names the current holder, which is what the UI needs.

If the caller already holds the claim, the response is **200**. A lost winner
response can be retried without turning into a conflict against yourself.

Viewers never reach the `UPDATE` (**403**). A user from another workspace gets
the same **404** as an unknown item. Unauthenticated requests get **401**.

The queue table still has no claim button. This step is the server contract.
