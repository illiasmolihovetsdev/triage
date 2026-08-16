import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { claimItemWithClient } from '@/services/items/claim'
import { resolveItemWithClient } from '@/services/items/resolve'
import { CLAIM_TTL_MS } from '@/utils/claimExpiry'

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BOB_USER_ID = 'user_bob'
const CAROL_USER_ID = 'user_carol'

const createDirectPrismaClient = () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'Set DIRECT_URL (or DATABASE_URL) before running resolve tests.'
    )
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const setupClient = createDirectPrismaClient()
const carolClient = createDirectPrismaClient()
const createdItemIdList: string[] = []

const createClaimedItem = async (
  title: string,
  claimedById: string,
  claimedAt = new Date()
) => {
  const itemRecord = await setupClient.item.create({
    data: {
      workspaceId: SUPPORT_WORKSPACE_ID,
      title,
      status: 'CLAIMED',
      claimedById,
      claimedAt,
    },
    select: { id: true },
  })

  createdItemIdList.push(itemRecord.id)
  return itemRecord.id
}

const getExpiredClaimedAt = () => new Date(Date.now() - CLAIM_TTL_MS - 1000)

describe('resolveItemWithClient', () => {
  beforeAll(async () => {
    await Promise.all([setupClient.$connect(), carolClient.$connect()])
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
    await Promise.all([setupClient.$disconnect(), carolClient.$disconnect()])
  })

  it('lets the claimer resolve a claimed item', async () => {
    const itemId = await createClaimedItem('R2 resolve as claimer', BOB_USER_ID)

    const resolveResult = await resolveItemWithClient(
      setupClient,
      itemId,
      BOB_USER_ID
    )

    expect(resolveResult.isSuccess).toBe(true)

    if (resolveResult.isSuccess) {
      expect(resolveResult.item.status).toBe('resolved')
      expect(resolveResult.item.claimerId).toBe(BOB_USER_ID)
      expect(resolveResult.item.notificationStatus).toBe('pending')
    }

    const storedItem = await setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true, resolvedAt: true },
    })

    expect(storedItem?.status).toBe('RESOLVED')
    expect(storedItem?.claimedById).toBe(BOB_USER_ID)
    expect(storedItem?.resolvedAt).not.toBeNull()

    const attemptRecord = await setupClient.notificationAttempt.findUnique({
      where: { itemId },
      select: { status: true, error: true, finishedAt: true },
    })

    expect(attemptRecord).toEqual({
      status: 'PENDING',
      error: null,
      finishedAt: null,
    })
  })

  it('returns success when the caller already resolved the item', async () => {
    const itemId = await createClaimedItem(
      'R2 idempotent self-resolve',
      BOB_USER_ID
    )

    const firstResolveResult = await resolveItemWithClient(
      setupClient,
      itemId,
      BOB_USER_ID
    )
    const retryResolveResult = await resolveItemWithClient(
      setupClient,
      itemId,
      BOB_USER_ID
    )

    expect(firstResolveResult.isSuccess).toBe(true)
    expect(retryResolveResult.isSuccess).toBe(true)

    if (retryResolveResult.isSuccess) {
      expect(retryResolveResult.item.status).toBe('resolved')
      expect(retryResolveResult.item.claimerId).toBe(BOB_USER_ID)
      expect(retryResolveResult.item.notificationStatus).toBe('pending')
    }

    const attemptCount = await setupClient.notificationAttempt.count({
      where: { itemId },
    })

    expect(attemptCount).toBe(1)
  })

  it('rejects a resolve from someone who does not hold the claim', async () => {
    const itemId = await createClaimedItem(
      'R2 resolve as non-claimer',
      BOB_USER_ID
    )

    const resolveResult = await resolveItemWithClient(
      setupClient,
      itemId,
      CAROL_USER_ID
    )

    expect(resolveResult).toMatchObject({
      isSuccess: false,
      statusCode: 409,
      code: 'RESOLVE_CONFLICT',
      message: 'Already claimed by Bob Marsh.',
    })

    const storedItem = await setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true, resolvedAt: true },
    })

    expect(storedItem).toEqual({
      status: 'CLAIMED',
      claimedById: BOB_USER_ID,
      resolvedAt: null,
    })

    const attemptCount = await setupClient.notificationAttempt.count({
      where: { itemId },
    })

    expect(attemptCount).toBe(0)
  })

  it('rejects a resolve on a pending item', async () => {
    const itemRecord = await setupClient.item.create({
      data: {
        workspaceId: SUPPORT_WORKSPACE_ID,
        title: 'R2 resolve pending item',
        status: 'PENDING',
      },
      select: { id: true },
    })
    createdItemIdList.push(itemRecord.id)

    const resolveResult = await resolveItemWithClient(
      setupClient,
      itemRecord.id,
      BOB_USER_ID
    )

    expect(resolveResult).toMatchObject({
      isSuccess: false,
      statusCode: 409,
      code: 'RESOLVE_CONFLICT',
      message: 'This item is no longer claimed.',
    })

    const attemptCount = await setupClient.notificationAttempt.count({
      where: { itemId: itemRecord.id },
    })

    expect(attemptCount).toBe(0)
  })

  it('rejects a resolve after the claim has expired', async () => {
    const itemId = await createClaimedItem(
      'R5 resolve expired claim',
      BOB_USER_ID,
      getExpiredClaimedAt()
    )

    const resolveResult = await resolveItemWithClient(
      setupClient,
      itemId,
      BOB_USER_ID
    )

    expect(resolveResult).toMatchObject({
      isSuccess: false,
      statusCode: 409,
      code: 'RESOLVE_CONFLICT',
      message: 'This claim has expired.',
    })

    const storedItem = await setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true, resolvedAt: true },
    })

    expect(storedItem).toEqual({
      status: 'CLAIMED',
      claimedById: BOB_USER_ID,
      resolvedAt: null,
    })
  })

  it('lets a steal win over a resolve when the claim is already expired', async () => {
    const itemId = await createClaimedItem(
      'R5 expired resolve vs steal',
      BOB_USER_ID,
      getExpiredClaimedAt()
    )

    const [resolveResult, claimResult] = await Promise.all([
      resolveItemWithClient(setupClient, itemId, BOB_USER_ID),
      claimItemWithClient(carolClient, itemId, CAROL_USER_ID),
    ])

    expect(resolveResult.isSuccess).toBe(false)
    expect(claimResult.isSuccess).toBe(true)

    const storedItem = await setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true, resolvedAt: true },
    })

    expect(storedItem).toEqual({
      status: 'CLAIMED',
      claimedById: CAROL_USER_ID,
      resolvedAt: null,
    })
  })

  it('lets a fresh resolve win over a steal attempt', async () => {
    const itemId = await createClaimedItem(
      'R5 fresh resolve vs steal',
      BOB_USER_ID,
      new Date()
    )

    const [resolveResult, claimResult] = await Promise.all([
      resolveItemWithClient(setupClient, itemId, BOB_USER_ID),
      claimItemWithClient(carolClient, itemId, CAROL_USER_ID),
    ])

    expect(resolveResult.isSuccess).toBe(true)
    expect(claimResult.isSuccess).toBe(false)

    const storedItem = await setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true },
    })

    expect(storedItem).toEqual({
      status: 'RESOLVED',
      claimedById: BOB_USER_ID,
    })
  })
})
