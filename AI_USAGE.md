# AI usage

AI generated a substantial amount of the implementation and supporting
material. It did not independently determine the final architecture, and
its output was not accepted unchecked.

The working loop was:

AI proposal → human review → reject or correct when necessary → update
project instructions when the same issue would otherwise recur → verify
with tests and runtime checks → commit and push myself → continue.

Architectural and final engineering decisions stayed under my control:
reviewing diffs, accepting or rejecting suggestions, verification,
commits, and pushes.

## Tools

Claude Opus was used primarily for the initial planning and architectural
reasoning: analysing the assignment, splitting it into R1 / R2 / R3,
identifying concurrency, authorization, workspace-isolation and serverless
concerns, and helping establish the implementation plan before coding.

Cursor (Grok / Composer) was used for the work inside the repository:
scaffolding, implementation, tests, debugging, documentation drafts, and
iterative changes. I chose Cursor because I had not used it for about six
months and wanted to set the AI workflow up from scratch rather than reuse
an existing configuration.

The split was intentional. Opus planned; Cursor implemented; I decided.

## Where it was used

- `create-next-app` scaffold, Prisma schema and migrations, seed SQL,
  Route Handlers, the queue UI, Vitest tests, `verify:r1` / `verify:r2`
- Drafts of `README.md`, `docs/IMPLEMENTATION.md`, and
  `docs/ARCHITECTURE.md`
- Debugging: the seed `random()` evaluated once for the whole statement;
  RLS left off after the first migration (PostgREST would have bypassed
  the app)

I did not treat the assistant as an autonomous developer, and I did not
allow it to push to Git.

## Workflow

Each feature went through a small, reviewable step:

1. Define or clarify the requirement.
2. Ask AI to implement that step only.
3. Review the proposed architecture and the diff.
4. Run the relevant tests and checks.
5. Correct the implementation, or update the project instructions if the
   same mistake could happen again.
6. Commit the accepted change myself.
7. Start the next step only after the current one was reviewed.

AI asked to push changes autonomously. I rejected that. The reason was
not a technical limitation: I wanted to keep review of the diff, the
decision that a step was complete, the commit, and the push.

## Project instructions

The Cursor / project instructions were not written once and left alone.
When generated output repeatedly missed the architecture or the workflow,
I turned the correction into a project-level rule so it would not have to
be applied by hand on every later step.

Examples that landed that way:

- Before starting the next implementation step, list any new library and
  explain why it is needed. Do not add it without approval.
- After a change, explain what changed and why in one place. Earlier
  explanations were scattered through the response and were hard to review.
- Types do not live in JSX/TSX. Shared types go in `src/types/`;
  component-specific props go in that component's `types.ts`.
- Components are folders, not bare files under `components/`. One
  component per `index.tsx`. Rendering stays in the component; request
  handling lives in services; reusable helpers go in shared utils;
  component-only helpers stay local.
- Browser-to-server calls, including mocked or emulated ones, live in the
  relevant `src/services/` folder.

## Disagreements

### 1. Component architecture, types, and logic placement

The first generated UI structure was not maintainable enough. I had it
restructured: one folder per component, one component per file, no bare
`.tsx` files under `components/`.

AI initially declared types inside JSX/TSX files. I rejected that in
favour of the type-file rule above.

AI also put more logic directly in components. I rejected that: the
component renders, hooks own local UI state, services own requests,
utils own the rest.

### 2. `memo` / `useCallback` on a small screen

The first UI pass wrapped every component in `memo` and every handler in
`useCallback`, following a React Native style guide that does not apply
here. This queue is a short table. Those wrappers did not skip any
expensive render and they made handlers look like hot-path code.

What shipped instead: plain functions and a `Button` that is not memoized.

- [`src/components/Button/index.tsx`](src/components/Button/index.tsx#L8-L21)
- [`src/components/UserPicker/hooks.ts`](src/components/UserPicker/hooks.ts#L24-L42)
- [`src/components/QueueTable/hooks.ts`](src/components/QueueTable/hooks.ts#L91-L126)

### 3. Cross-workspace access as 403

A typical generated authz helper returns 403 when the caller is
authenticated but not allowed to see the resource. That confirms to
anyone with a stolen item ID that the row exists.

What shipped instead: no membership in the item's workspace is the same
404 body as an unknown id. 403 is only for a caller who *is* in the
workspace (viewer, or not the claimer).

- [`src/utils/authorization.ts`](src/utils/authorization.ts#L68-L113)
- [`src/lib/authz.ts`](src/lib/authz.ts#L19-L65)

### 4. `verify:r3`

After R3, the assistant wanted `npm run verify:r3` (an HTTP script in the
same shape as R1/R2). I declined. R3's interesting behaviour is the
asynchronous notification lifecycle and the actual delivery guarantee,
not an HTTP script that waits about a second per resolve. Existing unit
and integration tests, plus checking the live row (`sent` / `failed`),
were more useful. `package.json` has `verify:r1` and `verify:r2` only.

### 5. R4 and R5 in the same plan

The first planning and implementation direction tried to include R4
(stable pagination) and R5 (expiring claims). I kept them out of the
final plan. They are optional and were not required to satisfy R1–R3.

## How the output was verified

Not “I read it carefully.” Specific checks:

- **Schema.** 14 invalid inserts (wrong status/column combinations,
  duplicate `NotificationAttempt.itemId`) inside a rolled-back
  transaction. PostgreSQL rejected all of them (`23514` / `23505`).
- **Seed.** First `generate_series` run produced 10,000 identical
  statuses because `random()` in an uncorrelated `LATERAL` is evaluated
  once. Fixed with `MATERIALIZED` CTEs; row counts and the 68/12/20
  spread re-checked in Supabase.
- **Session.** `tests/lib/session.test.ts` tampers with payload,
  signature, expiry, secret, and `alg: none`.
- **Authz matrix.** `tests/utils/authorization.test.ts` covers 401 / 403
  / 404 / `NOT_CLAIMER` without a database.
- **R1 in-process.** `tests/services/items/claim.test.ts` uses two
  Prisma clients on `DIRECT_URL` so the UPDATEs can actually overlap.
  A single pooled client with `connection_limit=1` would queue them and
  hide the race.
- **R1 over HTTP.** `npm run verify:r1` — one 200, one 409 naming the
  winner, database row matches.
- **R2 over HTTP.** `npm run verify:r2` — 401 / 403 / 404, leak check
  (Billing owner's 404 body equals a missing id), viewer and non-claimer,
  queue HTML isolation.
- **R3.** Unit tests that resolve stays `RESOLVED` when `notify()`
  throws; dispatch writes `FAILED` and does not retry; UI poll until
  `sent`/`failed`. Confirmed on the live app that resolve returns
  immediately and the cell updates without a refresh.
- **`after()`.** Semantics taken from Next.js (`waitUntil`, callbacks
  drain after the response). Not assumed from a blog post.
- **Deploy.** Production loads at
  [https://triage-seven-eta.vercel.app](https://triage-seven-eta.vercel.app).
  `npm test`, `npm run typecheck`, and `npm run lint` on the tree that
  shipped.
