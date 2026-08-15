# Decisions

Choices that shaped the running system. Each one is what shipped, not what
we would pick on a different assignment.

Built across 13–15 August 2026 as small reviewed steps. I did not keep a
precise hour log.

## 1. Exclusive claims are one conditional UPDATE

**Context.** Two members can hit claim at the same moment. Read-then-write
in the application is a race: both see `PENDING`, both write. The database
has to decide the winner.

**Choice.** One `updateMany` with `where: { id, status: 'PENDING' }`.
PostgreSQL locks the row, evaluates `WHERE`, and applies at most one update.
The loser matches zero rows, reads who holds the item now, and gets 409
`CLAIM_CONFLICT`. Retrying as the winner is 200.

**Rejected.** `BEGIN; SELECT … FOR UPDATE; UPDATE; COMMIT`. Also correct: it
takes the same row lock. It is a longer transaction, two round trips, and a
Prisma interactive transaction on a pooled serverless connection. The
conditional UPDATE is the smaller primitive that still makes the database
the referee.

**Cost.** The 409 names the *current* holder, not necessarily the original
winner. If the winner releases and a third member claims before the loser's
follow-up read, the UI reports the third member. That is what the row needs.

**Wrong later.** At 100× traffic the hot row is still one Postgres lock; the
bottleneck is the row, not the statement shape. Ten engineers will want a
generic “state machine” helper. That helper is how the `WHERE` clause
quietly disappears. The next requirement this would fight is R5: expiration
belongs in the same `WHERE`, not in a pre-check.

## 2. Mutations are Route Handlers, not Server Actions

**Context.** Claim, resolve, and release must be callable the way an
attacker would call them: a known item ID, a cookie, curl. Reviewers need
the same path.

**Choice.** `POST /api/items/[id]/claim|resolve|release`. Reads stay on
Server Components (`/queue`). Authorization runs in the handler before the
write.

**Rejected.** Server Actions. They are fine for form posts from this UI.
They are a worse contract for R2: the endpoint is a POST to an opaque
Next.js path, the error mapping is less obvious in curl, and it is easier
to forget that a Server Action is still a public HTTP endpoint. Route
Handlers make that obvious.

**Cost.** The client must `fetch` JSON and map status codes. There is no
shared Action type between the form and the server.

**Wrong later.** At 100× traffic this is irrelevant. Ten engineers will
duplicate fetch wrappers unless they stay in `src/services/`. The next
requirement that would strain this is a bulk operation: one Action with a
list is tempting, and that is how workspace IDs leak into the body.

## 3. Authorization lives in `requireItemAction`, and other-workspace is 404

**Context.** The client is not trusted. An attacker who knows an item ID
will call the Route Handler directly. The check has to see the signed
cookie *and* the item's real workspace. Middleware sees the cookie and the
URL. It does not see `item.workspaceId`.

**Choice.** Every item read and write goes through `requireItemAction` in
`src/lib/authz.ts`. Workspace comes from the item row. No membership →
the same 404 body as an unknown id. Viewer mutation → 403. Non-claimer
resolve/release → 403 `NOT_CLAIMER`. Owners have the same item permissions
as members; they cannot steal a claim. The 401/403/404 matrix is a pure
function in `src/utils/authorization.ts` so it can be tested without a
request.

**Rejected.** Middleware as the security boundary, or 403 for
cross-workspace access. Middleware cannot load the item, so it can only
prove “this cookie is valid”, which is authentication. A 403 on another
workspace's id confirms that the row exists.

**Cost.** Two database reads (item, membership) before every mutation.
Queue listing uses a sibling helper, `requireCallerMembership`, because
there is no item id yet. Those two entry points must stay in agreement.

**Wrong later.** At 100× the extra reads are cheap next to the claim
UPDATE. Ten engineers will add a route and forget `requireItemAction`;
that is the failure mode, which is why there is no second pattern. The
next requirement this fights is multiple memberships per user: the queue
refuses that today rather than guessing a workspace.

## 4. Notification is `best-effort-with-a-record`, via `after()`

**Context.** `notify()` sleeps about a second and throws on roughly one
call in five. It must not be made reliable. Resolve must not wait. A
Vercel invocation is not a daemon: a bare Promise after the response is
not a job system.

**Choice.** Resolve and a `NotificationAttempt` insert are one transaction.
The 200 returns `notificationStatus: 'pending'`. `after()` then calls
`notify()` once and writes `SENT` or `FAILED`. The item stays `RESOLVED`.
`FAILED` is not retried. A still-`PENDING` row can be dispatched again if
resolve is retried. The UI polls `GET /api/items/[id]` until the attempt
settles or five seconds pass.

**Rejected.** Fire-and-forget `void notify()` after the response. It does
not keep the invocation alive, and it leaves no row when the throw
happens, so failures disappear. Also rejected: awaiting `notify()`
(violates “resolve must not wait”) and a paid queue (Inngest, SQS) that
would let us claim at-least-once on a free-tier assignment that forbids
buying our way out.

**Cost.** About one in five attempts ends `FAILED` and stays that way.
If the function dies before `after()` finishes, the row stays `PENDING`.
If `notify()` succeeds and the status UPDATE fails, the row can remain
`PENDING` after a delivery that happened. The record is best-effort too.
We do not claim at-least-once or at-most-once.

**Wrong later.** At 100× traffic `after()` on the resolve path becomes a
throughput tax (~1s of invocation time per resolve). Ten engineers will
want retries and will “just call `notify()` again”, which is how you
accidentally get at-least-once without idempotent receivers. The next
requirement is a real provider; the attempt row is the right place to
attach it, the inline `notify()` is not.

## Deliberately not done

**R4 — stable pagination.** The queue loads at most 50 rows, newest
first. That is a cap so 10,000 rows never hit the response. It is not
pagination: there is no next page. Approach if we built it: keyset on
`(createdAt DESC, id DESC)` with index `(workspaceId, createdAt DESC, id
DESC)`, not `OFFSET`. Failure mode: a row that is claimed or resolved
while you page can disappear from a later page; you will not see a
stable snapshot of the whole queue. Offset would skip and repeat more
as the list mutates, and deep pages get linearly more expensive, which
is what `EXPLAIN ANALYZE` would show.

**R5 — expiring claims.** Nothing sweeps stale claims. Approach if we
built it: no daemon. Fold expiry into the same claim `UPDATE` (`status =
'PENDING'` OR (`status = 'CLAIMED'` AND `claimedAt` older than 30
minutes)). A resolve that arrives after expiry uses the same idea in its
`WHERE`; zero rows → 409, the item is claimable again. Lazy expiry means
an abandoned claim sits until someone else claims it.

**Retrying `FAILED` notifications.** The attempt row makes retries
possible. We did not add them. Retrying would let the docs say
at-least-once, which this `notify()` and this assignment do not earn,
and it would duplicate delivery whenever `notify()` succeeded but the
status write failed.

## First refactor

`useQueueActions` in `src/components/QueueTable/hooks.ts`. It owns claim,
resolve, release, conflict patching, and the notification poll. That is
three requirements in one hook. On day one of a real project I would
split the poll so R3 can change without touching the claim race. I left
it: one table, one local row list, and splitting during the assignment
would have duplicated that state for no second consumer.
