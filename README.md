# Triage

A shared work queue for a team. Items belong to a workspace; a member claims an
item so nobody duplicates the work, then resolves it or releases it back.

The interesting part is not the CRUD. It is what happens when two people claim
the same item at the same moment, what happens when someone calls the API with
an item ID from a workspace they do not belong to, and what happens to a
notification that fails after the response has already been sent.

**Live URL:** not deployed yet.

## Status

Built and reviewed in small steps. This table describes what actually runs
today, not what is planned.

| Requirement | State |
| --- | --- |
| Scaffold, schema, seed data | Done |
| Authentication (seeded users, signed cookie) | Done |
| Authorization module (item → workspace → role) | Done |
| Workspace-scoped queue view | Done |
| Atomic claim endpoint (R1 server) | Done |
| Claim UI reconciliation (R1) | Done |
| R1 — exactly one winner per claim | Done (`npm run verify:r1`) |
| R2 — workspace isolation and roles | Done (`npm run verify:r2`) |
| R3 — resolve and notify | Done (sent/failed appear on the open row) |
| R4, R5 (optional) | Not planned in this iteration |

## Setup

You need Node 20.9 or newer, npm, and a Supabase project. A free one is enough.

```bash
git clone https://github.com/illiasmolihovetsdev/triage.git
cd triage
npm install
cp .env.example .env
```

Now fill in `.env`. In the Supabase dashboard, open **Connect** and choose the
**ORMs → Prisma** tab; it prints both connection strings with your project
reference already substituted.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Transaction pooler, port `6543`. Used at runtime. |
| `DIRECT_URL` | Direct connection, port `5432`. Used by Prisma Migrate, which cannot run through a pooler. |
| `AUTH_SECRET` | Any 32-byte random string: `openssl rand -base64 32` |

Both URLs arrive containing a `[YOUR-PASSWORD]` placeholder. Replace the whole
thing, square brackets included, with your database password. Leaving the
brackets in produces an authentication failure that reads like a wrong password.

Then create the schema, generate the Prisma client, load the data, and start
the app:

```bash
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

The app serves on http://localhost:3000. The seed prints the accounts it
created, including which one is a viewer and which two workspaces exist; sign in
as any of them from the home page.

`npm run seed` clears the tables and rebuilds them, so it is safe to re-run.

## Verifying R1

The app must be running, and `.env` must point at the same database that app
uses.

```bash
npm run dev          # another terminal, or npm run start after a build
npm run verify:r1
```

Against a deployment:

```bash
VERIFY_BASE_URL=https://your-app.vercel.app npm run verify:r1
```

The script inserts a PENDING item, logs in as two members of that workspace,
and fires both claim requests at once. It passes only if:

- exactly one request returns 200
- the other returns 409 `CLAIM_CONFLICT`
- the 409 names the winner
- the database row is `CLAIMED` by that same user

It then deletes the item it created. A pass looks like:

```
Target: http://localhost:3000
Item: …
Bob: HTTP 200
Carol: HTTP 409
Winner: Bob (Bob Marsh)
Loser told: Already claimed by Bob Marsh.
Database: one CLAIMED row, same holder.
R1 passed.
```

## Verifying R2

The check lives in `requireItemAction` (`src/lib/authz.ts`), which every item
mutation calls before it writes. Workspace comes from the item row, never from
the client. Hidden buttons are not the boundary.

The app must be running, on the same database as `.env`.

```bash
npm run dev          # another terminal, or npm run start after a build
npm run verify:r2
```

Against a deployment:

```bash
VERIFY_BASE_URL=https://your-app.vercel.app npm run verify:r2
```

The script inserts a pending Support item and a claimed one, then attacks them
over HTTP. It passes only if:

- no cookie → **401** `UNAUTHENTICATED`
- Dave (viewer) → **403** `FORBIDDEN` on claim, resolve, and release
- Erin (Billing owner) → **404** `NOT_FOUND` on those Support items, with the
  same body as a missing id (existence does not leak)
- Carol (member) and Alice (owner) → **403** `NOT_CLAIMER` on Bob's claim
- the attacked rows are unchanged afterwards
- Dave's queue HTML contains the Support title; Erin's does not
- unauthenticated `GET /queue` is **307**

It then deletes the items it created.

### Curl recipes

The queue does not show item ids. Copy one from a claim request in the
browser network tab (`/api/items/<id>/claim`), or skip the recipes and run
`npm run verify:r2`, which performs the same attacks on rows it creates.
`CLAIMED_ID` must be an item Bob currently holds.

```bash
BASE=http://localhost:3000
ITEM_ID=replace-with-a-support-item-id
CLAIMED_ID=replace-with-bob-claimed-item-id

# No cookie → 401
curl -s -X POST "$BASE/api/items/$ITEM_ID/claim"

# Dave, viewer in Support → 403
curl -s -c dave.txt -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"userId":"user_dave"}'
curl -s -b dave.txt -X POST "$BASE/api/items/$ITEM_ID/claim"
curl -s -b dave.txt -X POST "$BASE/api/items/$CLAIMED_ID/resolve"
curl -s -b dave.txt -X POST "$BASE/api/items/$CLAIMED_ID/release"

# Erin, owner in Billing → 404, identical to a missing id
curl -s -c erin.txt -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"userId":"user_erin"}'
curl -s -b erin.txt -X POST "$BASE/api/items/$ITEM_ID/claim"
curl -s -b erin.txt -X POST "$BASE/api/items/item_r2_does_not_exist/claim"

# Carol does not hold CLAIMED_ID → 403 NOT_CLAIMER
curl -s -c carol.txt -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"userId":"user_carol"}'
curl -s -b carol.txt -X POST "$BASE/api/items/$CLAIMED_ID/resolve"
```

## Deploy

The Prisma client is generated at build time (it is not in git). Vercel runs
`vercel-build`, which is:

```bash
prisma generate && prisma migrate deploy && next build
```

`migrate deploy` uses `DIRECT_URL` (port 5432). The app uses `DATABASE_URL`
(pooled, port 6543). Seed is **not** part of deploy: `npm run seed` wipes
tables, so it is a one-off against that database, locally, when the project is
empty.

Import [the GitHub repo](https://github.com/illiasmolihovetsdev/triage) in
Vercel, or from this directory after `npx vercel login`:

```bash
npx vercel link
npx vercel env add DATABASE_URL
npx vercel env add DIRECT_URL
npx vercel env add AUTH_SECRET
npx vercel --prod
```

Set the same three values as `.env`. No paid add-ons. After the first deploy,
if the database is empty, run `npm run seed` once with `.env` pointed at that
project.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run build       # production build
npm run verify:r1   # two concurrent HTTP claims; app must be running
npm run verify:r2   # workspace isolation and roles over HTTP; app must be running
```

## Documentation

- `docs/IMPLEMENTATION.md` — how the running system works: structure, database
  invariants, authentication, seed data
- `docs/ARCHITECTURE.md` — architectural direction and the reasoning behind it
- `DECISIONS.md` — key decisions, rejected alternatives, and their costs (pending)
- `AI_USAGE.md` — where AI was used and how its output was verified (pending)
