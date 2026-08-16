import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { claimItemWithClient } from '@/services/items/claim'

/*
 * These tests hit real PostgreSQL. The interesting case is two overlapping
 * UPDATEs on the same PENDING row: the WHERE clause, not an application if,
 * decides the winner.
 *
 * Each claim uses its own Prisma client against DIRECT_URL so the two
 * statements can be in flight at once. The runtime pool is connection_limit=1
 * (serverless), which would queue them on a single client and hide the race.
 */

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BOB_USER_ID = 'user_bob'
const CAROL_USER_ID = 'user_carol'

const createDirectPrismaClient = () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Set DIRECT_URL (or DATABASE_URL) before running claim tests.')
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const setupClient = createDirectPrismaClient()
const bobClient = createDirectPrismaClient()
const carolClient = createDirectPrismaClient()

const createdItemIdList: string[] = []

const createPendingItem = async (title: string) => {
  const itemRecord = await setupClient.item.create({
    data: {
      workspaceId: SUPPORT_WORKSPACE_ID,
      title,
      status: 'PENDING',
    },
    select: { id: true },
  })

  createdItemIdList.push(itemRecord.id)
  return itemRecord.id
}

describe('claimItemWithClient', () => {
  beforeAll(async () => {
    await Promise.all([
      setupClient.$connect(),
      bobClient.$connect(),
      carolClient.$connect(),
    ])
  })

  afterEach(async () => {
    if (createdItemIdList.length === 0) {
      return
    }

    await setupClient.item.deleteMany({
      where: { id: { in: [...createdItemIdList] } },
    })
    createdItemIdList.length = 0
  })

  afterAll(async () => {
    await Promise.all([
      setupClient.$disconnect(),
      bobClient.$disconnect(),
      carolClient.$disconnect(),
    ])
  })

  it('lets exactly one of two concurrent claims win, and names the holder to the loser', async () => {
    const itemId = await createPendingItem('R1 concurrent claim')

    const [bobResult, carolResult] = await Promise.all([
      claimItemWithClient(bobClient, itemId, BOB_USER_ID),
      claimItemWithClient(carolClient, itemId, CAROL_USER_ID),
    ])

    const successList = [bobResult, carolResult].filter(
      (claimResult) => claimResult.isSuccess
    )
    const conflictList = [bobResult, carolResult].filter(
      (claimResult) => !claimResult.isSuccess && claimResult.code === 'CLAIM_CONFLICT'
    )

    expect(successList).toHaveLength(1)
    expect(conflictList).toHaveLength(1)

    const winnerResult = successList[0]
    const loserResult = conflictList[0]

    if (!winnerResult?.isSuccess || loserResult?.isSuccess !== false) {
      throw new Error('Expected one success and one conflict.')
    }

    expect(winnerResult.item.status).toBe('claimed')
    expect(loserResult.claimedBy?.id).toBe(winnerResult.item.claimerId)
    expect(loserResult.claimedBy?.name).toBe(winnerResult.item.claimerName)

    const storedItem = await setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true },
    })

    expect(storedItem).toEqual({
      status: 'CLAIMED',
      claimedById: winnerResult.item.claimerId,
    })
  })

  it('returns success when the caller already holds the claim', async () => {
    const itemId = await createPendingItem('R1 idempotent self-claim')

    const firstClaimResult = await claimItemWithClient(
      bobClient,
      itemId,
      BOB_USER_ID
    )
    const retryClaimResult = await claimItemWithClient(
      bobClient,
      itemId,
      BOB_USER_ID
    )

    expect(firstClaimResult.isSuccess).toBe(true)
    expect(retryClaimResult.isSuccess).toBe(true)

    if (retryClaimResult.isSuccess) {
      expect(retryClaimResult.item.claimerId).toBe(BOB_USER_ID)
      expect(retryClaimResult.item.status).toBe('claimed')
    }
  })

  it('returns 409 when the item is already resolved', async () => {
    const pendingItemId = await createPendingItem('R1 claim resolved item')
    const now = new Date()

    await setupClient.item.update({
      where: { id: pendingItemId },
      data: {
        status: 'CLAIMED',
        claimedById: BOB_USER_ID,
        claimedAt: now,
      },
    })
    await setupClient.item.update({
      where: { id: pendingItemId },
      data: {
        status: 'RESOLVED',
        resolvedAt: now,
      },
    })

    const claimResult = await claimItemWithClient(
      carolClient,
      pendingItemId,
      CAROL_USER_ID
    )

    expect(claimResult).toMatchObject({
      isSuccess: false,
      statusCode: 409,
      code: 'CLAIM_CONFLICT',
      claimedBy: { id: BOB_USER_ID },
    })
  })
})
