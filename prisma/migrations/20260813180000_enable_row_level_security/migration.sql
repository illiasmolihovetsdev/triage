-- Close the Supabase REST API as a route into these tables.
--
-- Supabase publishes every table in the `public` schema through PostgREST,
-- reachable with the project's publishable key. That path does not go through
-- this application, so none of the workspace membership and role checks in the
-- app would apply to it: anyone holding the key could read or modify items in
-- any workspace. Authorization is only a boundary if there is no way around it.
--
-- Enabling row level security without defining any policy makes PostgREST deny
-- every request, because it connects as the `anon` or `authenticated` role and
-- those roles have no policy granting them access.
--
-- The application is unaffected. It connects through Prisma as `postgres`,
-- which owns these tables, and a table owner bypasses row level security
-- unless the table is set to FORCE ROW LEVEL SECURITY. We deliberately do not
-- force it: PostgreSQL is not where this application's authorization lives,
-- and pretending otherwise would mean maintaining the rules in two places.
--
-- Authorization for the application itself is enforced in the server-side
-- code path documented in docs/ARCHITECTURE.md.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
