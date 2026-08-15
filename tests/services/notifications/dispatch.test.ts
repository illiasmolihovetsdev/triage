import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { resolveItemWithClient } from '@/services/items/resolve'
import { dispatchNotificationAttemptWithClient } from '@/services/notifications/dispatch'

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BOB_USER_ID = 'user_bob'

const createDirectPrismaClient = () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'Set DIRECT_URL (or DATABASE_URL) before running notification tests.'
    )
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const setupClient = createDirectPrismaClient()
const createdItemIdList: string[] = []

const createResolvedItem = async (title: string) => {
  const itemRecord = await setupClient.item.create({
    data: {
      workspaceId: SUPPORT_WORKSPACE_ID,
      title,
      status: 'CLAIMED',
      claimedById: BOB_USER_ID,
      claimedAt: new Date(),
    },
    select: { id: true },
  })

  createdItemIdList.push(itemRecord.id)

  const resolveResult = await resolveItemWithClient(
    setupClient,
    itemRecord.id,
    BOB_USER_ID
  )

  if (!resolveResult.isSuccess) {
    throw new Error('Expected resolve to succeed before dispatch.')
  }

  return itemRecord.id
}

const fetchAttemptAndItem = (itemId: string) =>
  Promise.all([
    setupClient.notificationAttempt.findUnique({
      where: { itemId },
      select: { status: true, error: true, finishedAt: true },
    }),
    setupClient.item.findUnique({
      where: { id: itemId },
      select: { status: true },
    }),
  ])

describe('dispatchNotificationAttemptWithClient', () => {
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

  it('marks the attempt SENT when notify succeeds, and leaves the item resolved', async () => {
    const itemId = await createResolvedItem('R3 dispatch sent')

    await dispatchNotificationAttemptWithClient(setupClient, itemId, async () => {
      return
    })

    const [attemptRecord, itemRecord] = await fetchAttemptAndItem(itemId)

    expect(itemRecord?.status).toBe('RESOLVED')
    expect(attemptRecord?.status).toBe('SENT')
    expect(attemptRecord?.error).toBeNull()
    expect(attemptRecord?.finishedAt).not.toBeNull()
  })

  it('marks the attempt FAILED when notify throws, and leaves the item resolved', async () => {
    const itemId = await createResolvedItem('R3 dispatch failed')

    await dispatchNotificationAttemptWithClient(setupClient, itemId, async () => {
      throw new Error('Notification delivery failed.')
    })

    const [attemptRecord, itemRecord] = await fetchAttemptAndItem(itemId)

    expect(itemRecord?.status).toBe('RESOLVED')
    expect(attemptRecord?.status).toBe('FAILED')
    expect(attemptRecord?.error).toBe('Notification delivery failed.')
    expect(attemptRecord?.finishedAt).not.toBeNull()
  })

  it('does not retry an attempt that is already SENT or FAILED', async () => {
    const itemId = await createResolvedItem('R3 dispatch once')
    let sendCount = 0

    const sendNotification = async () => {
      sendCount += 1
    }

    await dispatchNotificationAttemptWithClient(
      setupClient,
      itemId,
      sendNotification
    )
    await dispatchNotificationAttemptWithClient(setupClient, itemId, async () => {
      throw new Error('should not run')
    })

    const [attemptRecord] = await fetchAttemptAndItem(itemId)

    expect(sendCount).toBe(1)
    expect(attemptRecord?.status).toBe('SENT')
  })
})
