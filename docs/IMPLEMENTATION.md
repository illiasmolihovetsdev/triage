# Triage — Implementation

What the running system actually does today, and why it is built this way.

`ARCHITECTURE.md` is the forward-looking design document and still contains open
questions. This document is the opposite: it describes only what is implemented
and verified. If the two disagree, this one is right, and the architecture
document needs updating.

Everything below reflects the state of the project through R3. Production is
[https://triage-seven-eta.vercel.app](https://triage-seven-eta.vercel.app).
Vercel builds generate the Prisma client and apply migrations.

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
tests/          unit tests, mirroring src/ so source folders stay logic-only
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
  needs. `services/items/` also loads the capped queue page and performs claim,
  resolve, and release writes. Browser-to-server calls for those mutations live
  in separate files so Client Components never import Prisma.

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
what lets `tests/lib/session.test.ts` test the token rules directly, including
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

Every protected item operation goes through `requireItemAction` in
`src/lib/authz.ts`. Queue listing goes through `requireCallerMembership` in the
same file. Claim, resolve, release, and the single-item GET all call
`requireItemAction` before they read or write.

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

The UI hides claim, resolve, and release using `canRolePerformAction` plus,
for resolve and release, a check that the current user is the claimer. That is
display only. Curl still has to pass through `requireItemAction`.

A reviewer can run the same attacks without using the UI:

```bash
npm run verify:r2
```

That script is `scripts/verify-r2.ts`. It creates a pending Support item and a
claimed one, then calls the mutation routes with no cookie, as a viewer, as a
Billing owner, and as a Support member who does not hold the claim. It also
compares the Billing owner's 404 body to a missing id, so a stolen Support ID
cannot confirm that the row exists. `npm test` still covers the matrix as a
pure function; `verify:r2` is the proof that the Route Handlers did not skip
the check.

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
navigates to `/`. Isolation is: Alice's queue titles start with `Support`,
Erin's with `Billing`. A viewer sees the same rows as a member, without claim,
resolve, or release buttons. A member who does not hold a claimed row sees
neither Resolve nor Release on it. That hiding is display only; the matching
`POST` still rejects a viewer with 403 and a non-claimer with 403
`NOT_CLAIMER`.

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

The queue does not wait for a full refresh. `useQueueActions` keeps a local copy
of the rows. A 200 replaces that row with the returned item. A 409 patches
status and claimer from `claimedBy` and shows "Already claimed by …" on that
row. There is no optimistic claim: the button stays on Claiming... until the
server answers, so the table cannot show a holder the database rejected.

A reviewer can run the same race over HTTP without using the UI:

```bash
npm run verify:r1
```

That script is `scripts/verify-r1.ts`. It creates a PENDING item, logs in as
two members, fires both claims at once, checks the 200/409 pair against the
database row, and deletes the item. `npm test` still covers the UPDATE itself;
`verify:r1` is the assignment's runnable proof that the Route Handler does not
undo it.

## 9. Resolve and release

`POST /api/items/[id]/resolve` and `POST /api/items/[id]/release` follow the
same shape as claim: `requireItemAction` first, then one conditional update.

Resolve:

```sql
UPDATE "Item"
SET status = 'RESOLVED', "resolvedAt" = now()
WHERE id = $itemId AND status = 'CLAIMED' AND "claimedById" = $userId
```

Release:

```sql
UPDATE "Item"
SET status = 'PENDING', "claimedById" = NULL, "claimedAt" = NULL
WHERE id = $itemId AND status = 'CLAIMED' AND "claimedById" = $userId
```

The claimer check is therefore enforced twice. `requireItemAction` returns 403
`NOT_CLAIMER` before the write. The `WHERE` clause is the backstop: a caller
who is not the current claimer, or an item that is no longer `CLAIMED`, matches
zero rows. The loser of that write receives **409** with the current item so
the row can update without a refresh.

RESOLVED is terminal. Release does not clear `resolvedAt` because a `CLAIMED`
row cannot have one; the CHECK constraint already forbids that combination.
Owners have the same item permissions as members. They cannot resolve or
release someone else's claim.

A lost resolve response can be retried: the item is still `RESOLVED` with this
caller as claimer, so the second request returns **200**. A lost release
response cannot: after release the item is `PENDING` with no claimer, so
authorization returns 403 `NOT_CLAIMER`. That is honest rather than pretending
the retry still holds the claim.

These routes do not wait for `notify()`. Resolve and the attempt row are one
transaction:

1. `UPDATE` the item to `RESOLVED` where it is still `CLAIMED` by this caller.
2. `INSERT` a `NotificationAttempt` with status `PENDING`.
3. Commit. The 200 body includes `notificationStatus: 'pending'`.

If the insert fails, the status change rolls back: there is never a resolved
item without an attempt row, and never an attempt row for an item that is still
claimed. `itemId` is unique, so a retry after a lost 200 does not insert a
second row; the idempotent path sees `RESOLVED` and returns 200 with the
existing attempt.

`notify()` lives in `src/lib/notify.ts`. It sleeps about one second and throws
on roughly one call in five. It is not retried and is not awaited on the
resolve path.

## 10. Notification dispatch

After the 200 is sent, `after()` from `next/server` runs
`dispatchNotificationAttempt`. That is the platform `waitUntil` path: the
invocation stays alive long enough to *attempt* delivery. A bare unawaited
Promise after the response would not.

Dispatch reads the attempt row. If it is not still `PENDING`, it returns
without calling `notify()` — so an idempotent resolve retry does not send a
second time after `SENT` or `FAILED`. If it is `PENDING`:

1. Call `notify()` once.
2. On success, set the attempt to `SENT` with `finishedAt`.
3. On throw, set it to `FAILED` with `finishedAt` and the error message.

The item stays `RESOLVED` in every case. Notification failure cannot undo
resolve. A `FAILED` row is not retried.

**Actual guarantee: `best-effort-with-a-record`.**

- Resolve does not wait on `notify()`.
- We attempt delivery once after the response.
- We do not claim at-least-once (no retry of `FAILED`) or at-most-once without
  a record.
- If `notify()` succeeds and the status update fails, the row can remain
  `PENDING` after a delivery that happened. The record is best-effort too.
- If the function is killed before `after()` finishes, the row stays
  `PENDING`. An HTTP retry of resolve will schedule dispatch again because
  the row is still pending.

The 200 body still says `notificationStatus: 'pending'`. After it returns, the
queue polls `GET /api/items/[id]` (same `requireItemAction` read check, no
store cache) until the attempt is `SENT` or `FAILED`, or five seconds pass.
The open row then shows `sent` or `failed` without a page refresh. `failed` is
red so it cannot read as a quiet success. If the poll times out, the cell
stays `pending`, which is the truth if `after()` has not finished.

## 11. Deployment

The generated Prisma client is gitignored, so a Vercel build must create it.
The `vercel-build` script is `prisma generate && prisma migrate deploy && next
build`. Migrate uses `DIRECT_URL`; the running app uses `DATABASE_URL`. Seed
is not on that path: `npm run seed` truncates and rebuilds, which must not run
on every deploy.

`AUTH_SECRET`, `DATABASE_URL`, and `DIRECT_URL` are set in the Vercel project.
Production is [https://triage-seven-eta.vercel.app](https://triage-seven-eta.vercel.app).
