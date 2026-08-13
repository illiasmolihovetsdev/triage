import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { Role } from '../src/generated/prisma/enums'

/*
 * Seeds two workspaces, six users, and roughly 10,000 items.
 *
 * Two workspaces exist so that cross-workspace access can actually be tested:
 * a user from one workspace has a real item ID from the other to attack with.
 *
 * The items are inserted by a single generate_series statement rather than ten
 * thousand round trips. The status spread is deliberately uneven, because a
 * queue where every third item is resolved would hide the cost of paging
 * through a realistic backlog.
 */

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BILLING_WORKSPACE_ID = 'ws_billing'

const SUPPORT_ITEM_COUNT = 8_600
const BILLING_ITEM_COUNT = 1_400

const seededUserList = [
  {
    id: 'user_alice',
    name: 'Alice Nguyen',
    email: 'alice@triage.test',
    workspaceId: SUPPORT_WORKSPACE_ID,
    role: Role.OWNER,
  },
  {
    id: 'user_bob',
    name: 'Bob Marsh',
    email: 'bob@triage.test',
    workspaceId: SUPPORT_WORKSPACE_ID,
    role: Role.MEMBER,
  },
  {
    id: 'user_carol',
    name: 'Carol Diaz',
    email: 'carol@triage.test',
    workspaceId: SUPPORT_WORKSPACE_ID,
    role: Role.MEMBER,
  },
  {
    id: 'user_dave',
    name: 'Dave Okafor',
    email: 'dave@triage.test',
    workspaceId: SUPPORT_WORKSPACE_ID,
    role: Role.VIEWER,
  },
  {
    id: 'user_erin',
    name: 'Erin Walsh',
    email: 'erin@triage.test',
    workspaceId: BILLING_WORKSPACE_ID,
    role: Role.OWNER,
  },
  {
    id: 'user_frank',
    name: 'Frank Idris',
    email: 'frank@triage.test',
    workspaceId: BILLING_WORKSPACE_ID,
    role: Role.MEMBER,
  },
]

const createPrismaClient = () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Set DIRECT_URL (or DATABASE_URL) before seeding.')
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const prisma = createPrismaClient()

/*
 * Only users who may actually claim can appear as a claimant. Viewers are
 * excluded, so the seeded data never contradicts the permission rules the
 * application enforces.
 */
const getClaimantIdList = (workspaceId: string) =>
  seededUserList
    .filter(
      (user) => user.workspaceId === workspaceId && user.role !== Role.VIEWER
    )
    .map((user) => user.id)

const clearExistingData = async () => {
  // Order matters: children before parents, since the foreign keys restrict
  // rather than cascade in one direction.
  await prisma.notificationAttempt.deleteMany()
  await prisma.item.deleteMany()
  await prisma.workspaceMembership.deleteMany()
  await prisma.user.deleteMany()
  await prisma.workspace.deleteMany()
}

const createWorkspacesAndUsers = async () => {
  await prisma.workspace.createMany({
    data: [
      { id: SUPPORT_WORKSPACE_ID, name: 'Support Inbox' },
      { id: BILLING_WORKSPACE_ID, name: 'Billing Escalations' },
    ],
  })

  await prisma.user.createMany({
    data: seededUserList.map(({ id, name, email }) => ({ id, name, email })),
  })

  await prisma.workspaceMembership.createMany({
    data: seededUserList.map(({ id, workspaceId, role }) => ({
      userId: id,
      workspaceId,
      role,
    })),
  })
}

/*
 * One statement per workspace.
 *
 * Every row picks a random status, and the claim/resolve columns are derived
 * from that status so the CHECK constraints in the initial migration are
 * satisfied by construction. Timestamps are ordered: claimed after created,
 * resolved after claimed, and never in the future.
 *
 * The random values are drawn once per row in a MATERIALIZED CTE. That is not
 * decoration. random() is volatile, so if the planner inlines the subquery,
 * every reference to a derived value is evaluated again independently: an item
 * could be labelled PENDING in the status column while the claim columns were
 * computed as though it were CLAIMED, which the CHECK constraint would then
 * reject. MATERIALIZED forces one evaluation per row.
 */
const createItems = async (
  workspaceId: string,
  itemCount: number,
  titlePrefix: string
) => {
  const claimantIdList = getClaimantIdList(workspaceId)

  await prisma.$executeRaw`
    INSERT INTO "Item" (
      id, "workspaceId", title, status,
      "claimedById", "claimedAt", "resolvedAt", "createdAt", "updatedAt"
    )
    WITH rolls AS MATERIALIZED (
      SELECT
        series.n AS n,
        random() AS status_roll,
        random() AS subject_roll,
        random() AS claimant_roll,
        random() AS age_roll,
        random() AS claim_delay_roll,
        random() AS resolve_delay_roll
      FROM generate_series(1, ${itemCount}) AS series(n)
    ),
    shaped AS MATERIALIZED (
      SELECT
        rolls.n AS n,
        CASE
          WHEN rolls.status_roll < 0.68 THEN 'PENDING'
          WHEN rolls.status_roll < 0.80 THEN 'CLAIMED'
          ELSE 'RESOLVED'
        END AS status,
        (ARRAY[
          'Password reset request',
          'Duplicate charge reported',
          'Export job stuck',
          'Webhook delivery failing',
          'Account merge request',
          'Invoice missing VAT number',
          'SSO login loop',
          'Data retention question',
          'Rate limit raised',
          'Refund not received'
        ])[1 + floor(rolls.subject_roll * 10)::int] AS subject,
        (${claimantIdList}::text[])[
          1 + floor(rolls.claimant_roll * ${claimantIdList.length})::int
        ] AS claimant_id,
        now() - (rolls.age_roll * interval '90 days') AS created_at,
        rolls.claim_delay_roll AS claim_delay_roll,
        rolls.resolve_delay_roll AS resolve_delay_roll
      FROM rolls
    ),
    timed AS MATERIALIZED (
      SELECT
        shaped.n AS n,
        shaped.status AS status,
        shaped.subject AS subject,
        shaped.claimant_id AS claimant_id,
        shaped.created_at AS created_at,
        least(
          now(),
          shaped.created_at + (shaped.claim_delay_roll * interval '36 hours')
        ) AS claimed_at,
        least(
          now(),
          shaped.created_at + interval '36 hours'
            + (shaped.resolve_delay_roll * interval '72 hours')
        ) AS resolved_at
      FROM shaped
    )
    SELECT
      gen_random_uuid()::text,
      ${workspaceId},
      ${titlePrefix} || ' #' || timed.n || ' — ' || timed.subject,
      timed.status::"ItemStatus",
      CASE WHEN timed.status = 'PENDING' THEN NULL
           ELSE timed.claimant_id END,
      CASE WHEN timed.status = 'PENDING' THEN NULL
           ELSE timed.claimed_at END,
      CASE WHEN timed.status = 'RESOLVED' THEN timed.resolved_at
           ELSE NULL END,
      timed.created_at,
      CASE WHEN timed.status = 'RESOLVED' THEN timed.resolved_at
           WHEN timed.status = 'CLAIMED' THEN timed.claimed_at
           ELSE timed.created_at END
    FROM timed
  `
}

/*
 * Resolved items carry a notification record, because resolving is what
 * triggers one. The spread mirrors the failure rate the assignment specifies:
 * most delivered, roughly a fifth failed, and a few left PENDING to represent
 * attempts whose outcome was never written back.
 */
const createNotificationAttempts = async () => {
  await prisma.$executeRaw`
    INSERT INTO "NotificationAttempt" (
      id, "itemId", status, error, "createdAt", "finishedAt"
    )
    WITH outcomes AS MATERIALIZED (
      SELECT
        resolved.id AS item_id,
        resolved."resolvedAt" AS resolved_at,
        CASE
          WHEN random() < 0.78 THEN 'SENT'
          WHEN random() < 0.95 THEN 'FAILED'
          ELSE 'PENDING'
        END AS status
      FROM "Item" AS resolved
      WHERE resolved.status = 'RESOLVED'
    )
    SELECT
      gen_random_uuid()::text,
      outcomes.item_id,
      outcomes.status::"NotificationStatus",
      CASE WHEN outcomes.status = 'FAILED'
           THEN 'notify() failed: simulated upstream error'
           ELSE NULL END,
      outcomes.resolved_at,
      CASE WHEN outcomes.status = 'PENDING' THEN NULL
           ELSE outcomes.resolved_at + interval '1 second' END
    FROM outcomes
  `
}

const reportSeededData = async () => {
  const statusCountList = await prisma.item.groupBy({
    by: ['workspaceId', 'status'],
    _count: { _all: true },
    orderBy: [{ workspaceId: 'asc' }, { status: 'asc' }],
  })

  const notificationCountList = await prisma.notificationAttempt.groupBy({
    by: ['status'],
    _count: { _all: true },
    orderBy: { status: 'asc' },
  })

  const itemTotal = await prisma.item.count()

  console.log('\nItems by workspace and status:')
  statusCountList.forEach((row) => {
    console.log(
      `  ${row.workspaceId.padEnd(12)} ${row.status.padEnd(9)} ${row._count._all}`
    )
  })

  console.log('\nNotification attempts by status:')
  notificationCountList.forEach((row) => {
    console.log(`  ${row.status.padEnd(9)} ${row._count._all}`)
  })

  console.log(`\nTotal items: ${itemTotal}`)
}

const seed = async () => {
  console.log('Clearing existing data...')
  await clearExistingData()

  console.log('Creating workspaces, users, and memberships...')
  await createWorkspacesAndUsers()

  console.log(`Creating ${SUPPORT_ITEM_COUNT} items for Support Inbox...`)
  await createItems(SUPPORT_WORKSPACE_ID, SUPPORT_ITEM_COUNT, 'Support')

  console.log(`Creating ${BILLING_ITEM_COUNT} items for Billing Escalations...`)
  await createItems(BILLING_WORKSPACE_ID, BILLING_ITEM_COUNT, 'Billing')

  console.log('Creating notification attempts for resolved items...')
  await createNotificationAttempts()

  await reportSeededData()
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (seedError) => {
    console.error(seedError)
    await prisma.$disconnect()
    process.exit(1)
  })
