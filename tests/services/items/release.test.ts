import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { releaseItemWithClient } from '@/services/items/release'

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BOB_USER_ID = 'user_bob'
const CAROL_USER_ID = 'user_carol'

const createDirectPrismaClient = () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'Set DIRECT_URL (or DATABASE_URL) before running release tests.'
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

describe('releaseItemWithClient', () => {
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

  it('returns a claimed item to pending and clears the claimer', async () => {
    const itemId = await createClaimedItem('R2 release as claimer', BOB_USER_ID)

    const releaseResult = await releaseItemWithClient(
      setupClient,
      itemId,
      BOB_USER_ID
    )

    expect(releaseResult.isSuccess).toBe(true)

    if (releaseResult.isSuccess) {
      expect(releaseResult.item.status).toBe('pending')
      expect(releaseResult.item.claimerId).toBeNull()
      expect(releaseResult.item.claimerName).toBeNull()
    }

    const storedItem = await setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true, claimedAt: true },
    })

    expect(storedItem).toEqual({
      status: 'PENDING',
      claimedById: null,
      claimedAt: null,
    })
  })

  it('rejects a release from someone who does not hold the claim', async () => {
    const itemId = await createClaimedItem(
      'R2 release as non-claimer',
      BOB_USER_ID
    )

    const releaseResult = await releaseItemWithClient(
      setupClient,
      itemId,
      CAROL_USER_ID
    )

    expect(releaseResult).toMatchObject({
      isSuccess: false,
      statusCode: 409,
      code: 'RELEASE_CONFLICT',
      message: 'Already claimed by Bob Marsh.',
    })

    const storedItem = await setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true },
    })

    expect(storedItem).toEqual({
      status: 'CLAIMED',
      claimedById: BOB_USER_ID,
    })
  })

  it('rejects a release on a resolved item', async () => {
    const itemId = await createClaimedItem(
      'R2 release resolved item',
      BOB_USER_ID
    )
    const now = new Date()

    await setupClient.item.update({
      where: { id: itemId },
      data: {
        status: 'RESOLVED',
        resolvedAt: now,
      },
    })

    const releaseResult = await releaseItemWithClient(
      setupClient,
      itemId,
      BOB_USER_ID
    )

    expect(releaseResult).toMatchObject({
      isSuccess: false,
      statusCode: 409,
      code: 'RELEASE_CONFLICT',
      message: 'This item is already resolved.',
    })
  })
})
