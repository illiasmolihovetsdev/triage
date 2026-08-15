import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { resolveItemWithClient } from '@/services/items/resolve'

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
const createdItemIdList: string[] = []

const createClaimedItem = async (title: string, claimedById: string) => {
  const itemRecord = await setupClient.item.create({
    data: {
      workspaceId: SUPPORT_WORKSPACE_ID,
      title,
      status: 'CLAIMED',
      claimedById,
      claimedAt: new Date(),
    },
    select: { id: true },
  })

  createdItemIdList.push(itemRecord.id)
  return itemRecord.id
}

describe('resolveItemWithClient', () => {
  beforeAll(async () => {
    await setupClient.$connect()
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
    await setupClient.$disconnect()
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
})
