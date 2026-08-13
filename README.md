# Triage

A shared work queue for a team. Items belong to a workspace; a member claims an
item so nobody duplicates the work, then resolves it or releases it back.

The interesting part is not the CRUD. It is what happens when two people claim
the same item at the same moment, what happens when someone calls the API with
an item ID from a workspace they do not belong to, and what happens to a
notification that fails after the response has already been sent.

## Status

Work in progress, built and reviewed in small steps. This section is kept
honest: it describes what actually runs today, not what is planned.

| Requirement | State |
| --- | --- |
| Project scaffold | Done |
| Database schema and seed | Not started |
| Authentication (seeded users, signed cookie) | Not started |
| R1 — exactly one winner per claim | Not started |
| R2 — workspace isolation and roles | Not started |
| R3 — resolve and notify | Not started |
| R4 — stable pagination (optional) | Not planned in this iteration |
| R5 — expiring claims (optional) | Not planned in this iteration |

Live URL: not deployed yet.

## Stack

- Next.js 16 (App Router) with TypeScript
- Tailwind CSS v4
- Prisma 7 against Supabase PostgreSQL
- `jose` for the signed session cookie
- Vitest for tests
- Deployed on Vercel

## Requirements

- Node 20.9 or newer (developed on Node 24)
- npm
- A free Supabase project, for the steps that need a database

## Running locally

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

The app serves on http://localhost:3000.

`.env.example` documents every variable that must be set. `DATABASE_URL` is the
pooled Supabase connection used at runtime; `DIRECT_URL` is the direct
connection, needed separately because Prisma Migrate cannot run through a
transaction pooler.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run build       # production build
```

There are no tests yet. They arrive with the features they cover, so that each
step can be verified on its own.

## Seeding

Not implemented yet. The plan is roughly 10,000 items across two workspaces with
an uneven status spread, so that pagination and queue behaviour are exercised
against a realistic row count rather than a handful of rows.

## Verifying R1

Not implemented yet. When claiming exists, this section will describe a runnable
script that fires two genuinely concurrent claim requests at the same item and
asserts that exactly one wins while the loser is told who holds it.

## Documentation

- `docs/ARCHITECTURE.md` — architectural direction and the reasoning behind it
- `DECISIONS.md` — key decisions, rejected alternatives, and their costs (pending)
- `AI_USAGE.md` — where AI was used and how its output was verified (pending)
