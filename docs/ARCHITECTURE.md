# Triage — Architecture

## Status

This document describes the current architectural direction of the Triage application.

Some implementation decisions are intentionally left open until the relevant requirement is analyzed.

Final architectural decisions should be reflected in `DECISIONS.md`.

## 1. System overview

Triage is a shared queue application.

The application uses a single Next.js codebase for both the frontend and server-side application logic.

Core layers:

- UI: Next.js App Router, React, Tailwind CSS
- Server: Next.js Server Actions and/or Route Handlers
- Business logic: authentication, authorization, and item operations
- ORM: Prisma
- Database: Supabase PostgreSQL
- Deployment: Vercel

The assignment does not require a separate backend service such as NestJS.

## 2. Domain entities

### User

Represents a seeded application user.

Responsibilities:

- identify the authenticated user
- participate in workspace memberships
- perform actions allowed by the user's role

Potential fields:

- `id`
- `name`
- `email` or identifier
- `createdAt`

### Workspace

Represents an isolated team/work area.

Potential fields:

- `id`
- `name`
- `createdAt`

### WorkspaceMembership

Represents a user's membership and role within a workspace.

Potential fields:

- `userId`
- `workspaceId`
- `role`

Supported roles:

- `owner`
- `member`
- `viewer`

### Item

Represents a unit of work in the shared queue.

Potential fields:

- `id`
- `workspaceId`
- `status`
- `claimedBy`
- `claimedAt`
- `resolvedAt`
- `createdAt`
- `updatedAt`

The final schema should be based on the required state transitions and concurrency requirements.

### Notification / NotificationAttempt

R3 may require a durable record representing notification work or its result.

The final model depends on the notification guarantee selected for the implementation.

Do not introduce this model purely for abstraction. Introduce it only if required to provide the selected guarantee or prevent important state from being lost.

## 3. Authentication

Real OAuth is intentionally out of scope.

Authentication should use the simplified mechanism requested by the assignment:

1. The user selects one of the seeded users.
2. The server creates a signed authentication cookie.
3. Server-side code resolves the current user from the cookie.
4. Protected operations use the authenticated user identity.

The client must not be trusted to define the current user.

## 4. Authorization

Authorization is a server-side concern.

Every protected operation should establish:

1. The authenticated user.
2. The target resource.
3. The workspace that owns the resource.
4. The user's membership in that workspace.
5. Whether the user's role permits the requested action.

The client must not be trusted to provide or override:

- user ID
- role
- workspace membership
- authorization result

Client-side permission checks may be used for UI behavior, but they are not security boundaries.

## 5. Workspace isolation

Every item belongs to exactly one workspace.

Access to an item should be authorized using the item's actual workspace rather than trusting a workspace ID supplied by the client.

The server should conceptually:

1. Receive the item ID.
2. Resolve the item.
3. Determine the item's workspace.
4. Check the authenticated user's membership in that workspace.
5. Check the role required for the requested action.
6. Execute the operation only if authorized.

This must apply to reads and writes.

The implementation must protect against direct requests using another workspace's item ID.

## 6. Permission model

Initial permissions:

- `owner`: read, claim, resolve, and release items in the workspace.
- `member`: read, claim, resolve, and release items in the workspace.
- `viewer`: read items but cannot claim, resolve, or release them.

Permission rules should be represented explicitly in server-side code.

Avoid duplicating permission logic throughout UI components and routes.

## 7. Item lifecycle

The intended lifecycle is:

- `PENDING` -> `CLAIMED` when a claim succeeds.
- `CLAIMED` -> `RESOLVED` when the item is resolved.
- `CLAIMED` -> `PENDING` when the claim is released.

The implementation must explicitly decide:

- whether resolved items can become active again
- whether users can release another user's claim
- whether owners have different permissions from members
- what happens when an already-claimed item is claimed
- what happens when an already-resolved item is modified
- which fields are cleared when a claim is released

Record these decisions in `DECISIONS.md`.

## 8. R1 — Concurrent claiming

### Requirement

Two members may attempt to claim the same item simultaneously.

The system must guarantee:

- exactly one request succeeds
- the losing request receives an explicit conflict/result
- the losing user learns who currently owns the item
- the UI reconciles without a manual refresh

### Critical invariant

An unclaimed item can transition to a claimed state only once for concurrent claim attempts.

This invariant must be enforced at the database/concurrency level.

A simple sequence of:

1. read item
2. check whether it is unclaimed
3. update item

is not sufficient unless protected by an appropriate transaction or atomic database operation.

### Candidate approaches

Compare:

- atomic conditional update
- transaction with row-level locking or appropriate isolation
- other PostgreSQL concurrency mechanisms supported by Prisma

Evaluate:

- correctness
- PostgreSQL behavior
- Prisma support
- complexity
- error handling
- observability

The final decision belongs in `DECISIONS.md`.

## 9. R1 — UI reconciliation

The UI must represent both claim outcomes clearly.

Successful claim:

- the item becomes claimed
- the current user is shown as the owner

Lost race:

- the item remains claimed
- the current owner is shown
- the user receives clear feedback that another member claimed it first

A failed claim must not silently leave stale UI state.

## 10. R2 — Authorization boundary

Authorization should be enforced close to the server-side business operation.

A protected operation should:

1. authenticate the request
2. validate input
3. resolve the target resource
4. verify workspace membership
5. verify the required role
6. execute the business operation
7. return an explicit result

The exact placement may vary depending on whether Server Actions, Route Handlers, or both are used.

## 11. R3 — Notification architecture

The assignment provides a notification function that:

- waits approximately one second
- throws on approximately one in five calls

The notification function itself must not be made reliable.

Resolving an item must not wait for notification completion.

The implementation must not assume that an unawaited Promise will reliably continue after a Vercel serverless response has been returned.

### Approaches to evaluate

#### Synchronous notification

Resolve the item and wait for `notify()` before returning.

Problem:

- resolving becomes dependent on notification latency
- notification failure can affect the resolve request

This does not satisfy the requirement that resolving must not wait for notification.

#### Fire-and-forget Promise

Start `notify()` without awaiting it and return the response.

Problem:

- serverless execution after the response is not a durable background-job mechanism
- notification completion is not guaranteed

Do not treat this as reliable delivery.

#### `after()` from `next/server`

Schedule `notify()` in an `after()` callback and return the response immediately.

Verified semantics (from the Next.js source, not assumed):

- `after()` is implemented on top of the platform `waitUntil`. It throws if `waitUntil` is unavailable in the environment.
- Callbacks are queued in a paused queue and drained only once the request closes, so the response is not delayed.
- The invocation is kept alive until the queued work settles. This is what a bare unawaited Promise does not give.
- Callback rejections are caught and passed to an error reporter. They are not retried and not surfaced to the client.

What this means for R3:

- `after()` solves "the invocation stays alive long enough for `notify()` to run".
- `after()` does not solve "the notification eventually succeeds".

Given a ~20% failure rate, `after()` alone silently drops roughly one in five notifications and leaves no record of the loss.

`after()` alone is therefore `at-most-once`. It must not be described as `at-least-once`.

#### Durable database record

Persist notification work or its outcome in PostgreSQL.

Potential benefits:

- durable record
- observable failures
- precise delivery guarantee

The exact behavior depends on when notification is executed and how failures are recorded.

#### External durable queue

Use a dedicated queue or background-job service.

Potential benefit:

- stronger production-grade delivery semantics

Potential cost:

- additional infrastructure
- unnecessary complexity for this assignment
- possible conflict with the free-tier constraint

The final approach should be selected after analyzing the assignment constraints.

## 12. Notification guarantee

The implementation must explicitly state the guarantee it actually provides.

Possible guarantees:

- `at-most-once`
- `at-least-once`
- `best-effort-with-a-record`

Documentation must not claim stronger behavior than the implementation provides.

Record the selected guarantee in `DECISIONS.md`.

## 13. Database responsibilities

PostgreSQL should enforce important invariants whenever practical.

Consider:

- workspace relationships
- membership uniqueness
- item ownership
- claim concurrency
- valid state transitions
- notification records
- query indexes

Indexes should be based on actual access patterns.

Avoid adding indexes without a query or constraint that benefits from them.

## 14. Pagination

R4 is optional.

If implemented, the queue should not be fetched in full.

Evaluate:

- offset pagination
- cursor/keyset pagination
- stable ordering
- filtering
- concurrent modifications
- deep-page performance

Document:

- pagination strategy
- ordering strategy
- failure mode
- relevant indexes
- `EXPLAIN ANALYZE` for the naive deep-page query
- `EXPLAIN ANALYZE` for the selected approach

## 15. Claim expiration

R5 is optional.

Claims older than 30 minutes should become available again.

Vercel does not provide a permanently running process, so the implementation must define how expiration is triggered.

Potential approaches:

- scheduled execution
- lazy expiration during normal requests
- database-side logic
- external scheduler

Also define the race between claim expiration and a late resolve request.

## 16. Server/API boundary

The application should use Next.js for both frontend and backend functionality.

Possible server-side mechanisms:

- Server Actions
- Route Handlers
- a combination

Selection criteria:

- explicit authorization
- testability
- clear error handling
- simple client/server boundaries
- minimal unnecessary infrastructure

Do not introduce a separate backend service unless a concrete requirement justifies it.

## 17. Error model

The server should distinguish meaningful failure categories where appropriate:

- unauthenticated
- forbidden
- not found
- conflict
- validation error
- internal/server error

R1 should return an explicit conflict when the claim is lost.

The client should map server results to truthful UI states.

## 18. Testing strategy

Testing should focus on behaviors most likely to be implemented incorrectly.

### R1

Verify concurrent claim attempts.

Expected result:

- one request succeeds
- one request loses
- the losing request can identify the current owner
- the database ends in a single claimed state

### R2

Verify:

- authorized member access
- unauthorized cross-workspace reads
- unauthorized cross-workspace writes
- viewer read access
- viewer claim rejection
- viewer resolve rejection
- viewer release rejection
- direct requests using another workspace's item ID

### R3

Verify:

- resolving an item changes its state
- notification success does not block resolving
- notification failure does not silently undo the resolve
- the selected notification guarantee is represented by durable state and/or observable results

## 19. Observability

Keep observability proportional to the assignment.

Useful information may include:

- authenticated user
- workspace
- item
- action
- result
- notification status

Avoid introducing a full observability platform unless necessary.

## 20. Future scaling considerations

### At 100x traffic

Potential concerns:

- database contention
- connection management
- hot rows
- pagination performance
- notification throughput
- rate limiting

### With ten engineers

Potential concerns:

- clearer domain boundaries
- shared authorization primitives
- stronger integration tests
- consistent error handling
- API conventions
- ownership of business logic

### With future requirements

Potential future requirements may include:

- audit logs
- claim expiration
- notification retries
- bulk operations
- multiple workspace memberships
- richer permissions
- real authentication
- external notification providers

Do not implement these prematurely.

## 21. Open decisions

Finalize during implementation:

- exact Prisma/database schema
- item status representation
- claim concurrency strategy
- authorization placement
- notification delivery model
- notification guarantee
- Server Actions vs Route Handlers
- pagination strategy if R4 is implemented
- claim expiration strategy if R5 is implemented

Final decisions should be recorded in `DECISIONS.md`.
