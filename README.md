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
| R1 — exactly one winner per claim | Server done, UI not started |
| R2 — workspace isolation and roles | Not started |
| R3 — resolve and notify | Not started |
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

Then create the schema, load the data, and start the app:

```bash
npx prisma migrate deploy
npm run seed
npm run dev
```

The app serves on http://localhost:3000. The seed prints the accounts it
created, including which one is a viewer and which two workspaces exist; sign in
as any of them from the home page.

`npm run seed` clears the tables and rebuilds them, so it is safe to re-run.

## Verifying R1

Not implemented yet.

When claiming exists, this section will describe a single command that fires two
genuinely concurrent claim requests at the same item and asserts that exactly one
wins, that the loser is told who holds the claim, and that the database ends in
one claimed state. Until that command exists and passes, nothing here should be
read as a guarantee.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run build       # production build
```

## Documentation

- `docs/IMPLEMENTATION.md` — how the running system works: structure, database
  invariants, authentication, seed data
- `docs/ARCHITECTURE.md` — architectural direction and the reasoning behind it
- `DECISIONS.md` — key decisions, rejected alternatives, and their costs (pending)
- `AI_USAGE.md` — where AI was used and how its output was verified (pending)
