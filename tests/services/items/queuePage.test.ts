import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@/generated/prisma/client'
import { encodeQueueCursor } from '@/services/items/queueCursor'
import { fetchQueuePageWithClient } from '@/services/items/queuePage'

/*
 * Keyset paging against real PostgreSQL. The interesting case is that a write
 * to an earlier row does not change which ids appear on page 2, because the
 * seek uses (createdAt, id) rather than OFFSET.
 */

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BOB_USER_ID = 'user_bob'
const KEYSET_PAGE_SIZE = 2
const KEYSET_CREATED_AT_BASE = new Date('2099-01-01T00:00:00.000Z')

const createDirectPrismaClient = () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'Set DIRECT_URL (or DATABASE_URL) before running queue page tests.'
    )
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const setupClient = createDirectPrismaClient()

const deleteKeysetTestItems = async () => {
  await setupClient.item.deleteMany({
    where: { title: { startsWith: 'R4 keyset' } },
  })
}

const createQueuedItem = async (title: string, createdAt: Date) => {
  const itemRecord = await setupClient.item.create({
    data: {
      workspaceId: SUPPORT_WORKSPACE_ID,
      title,
      status: 'PENDING',
      createdAt,
    },
    select: { id: true, createdAt: true },
  })

  return itemRecord
}

describe('fetchQueuePageWithClient', () => {
  beforeAll(async () => {
    await setupClient.$connect()
    await deleteKeysetTestItems()
  })

  afterEach(async () => {
    await deleteKeysetTestItems()
  })

  afterAll(async () => {
    await setupClient.$disconnect()
  })

  it('returns page 2 by keyset, and claiming a page-1 row does not shift it', async () => {
    const oldestItem = await createQueuedItem(
      'R4 keyset oldest',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 1000)
    )
    const olderItem = await createQueuedItem(
      'R4 keyset older',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 2000)
    )
    const newerItem = await createQueuedItem(
      'R4 keyset newer',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 3000)
    )
    const newestItem = await createQueuedItem(
      'R4 keyset newest',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 4000)
    )

    const firstPageResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      { pageSize: KEYSET_PAGE_SIZE }
    )

    expect(firstPageResult.isSuccess).toBe(true)

    if (!firstPageResult.isSuccess) {
      throw new Error('Expected the first page to load.')
    }

    expect(firstPageResult.itemList.map((queueItem) => queueItem.id)).toEqual([
      newestItem.id,
      newerItem.id,
    ])
    expect(firstPageResult.hasNextPage).toBe(true)
    expect(firstPageResult.hasPreviousPage).toBe(false)
    expect(firstPageResult.prevCursor).toBeNull()
    expect(firstPageResult.nextCursor).toBe(
      encodeQueueCursor({
        createdAt: newerItem.createdAt,
        id: newerItem.id,
      })
    )

    const secondPageResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      {
        cursorToken: firstPageResult.nextCursor ?? undefined,
        pageSize: KEYSET_PAGE_SIZE,
      }
    )

    expect(secondPageResult.isSuccess).toBe(true)

    if (!secondPageResult.isSuccess) {
      throw new Error('Expected the second page to load.')
    }

    expect(secondPageResult.itemList.map((queueItem) => queueItem.id)).toEqual([
      olderItem.id,
      oldestItem.id,
    ])
    expect(secondPageResult.hasPreviousPage).toBe(true)
    expect(secondPageResult.prevCursor).toBe(
      encodeQueueCursor({
        createdAt: olderItem.createdAt,
        id: olderItem.id,
      })
    )

    await setupClient.item.update({
      where: { id: newestItem.id },
      data: {
        status: 'CLAIMED',
        claimedById: BOB_USER_ID,
        claimedAt: new Date(),
      },
    })

    const secondPageAfterClaimResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      {
        cursorToken: firstPageResult.nextCursor ?? undefined,
        pageSize: KEYSET_PAGE_SIZE,
      }
    )

    expect(secondPageAfterClaimResult.isSuccess).toBe(true)

    if (!secondPageAfterClaimResult.isSuccess) {
      throw new Error('Expected the second page to load after the claim.')
    }

    expect(
      secondPageAfterClaimResult.itemList.map((queueItem) => queueItem.id)
    ).toEqual([olderItem.id, oldestItem.id])
  })

  it('treats an invalid cursor as the first page', async () => {
    const queuedItem = await createQueuedItem(
      'R4 keyset invalid cursor',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 5000)
    )

    const invalidCursorResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      {
        cursorToken: 'not-a-cursor',
        pageSize: KEYSET_PAGE_SIZE,
      }
    )

    expect(invalidCursorResult.isSuccess).toBe(true)

    if (!invalidCursorResult.isSuccess) {
      throw new Error('Expected an invalid cursor to fall back to page 1.')
    }

    expect(invalidCursorResult.itemList[0]?.id).toBe(queuedItem.id)
  })

  it('returns the previous page from a before cursor without using OFFSET', async () => {
    const itemByAgeList = []

    for (const createdAtOffset of [1000, 2000, 3000, 4000, 5000, 6000]) {
      itemByAgeList.push(
        await createQueuedItem(
          `R4 keyset before ${createdAtOffset}`,
          new Date(KEYSET_CREATED_AT_BASE.getTime() + createdAtOffset)
        )
      )
    }
    const newestItem = itemByAgeList[5]
    const secondNewestItem = itemByAgeList[4]
    const thirdNewestItem = itemByAgeList[3]
    const fourthNewestItem = itemByAgeList[2]

    if (
      !newestItem ||
      !secondNewestItem ||
      !thirdNewestItem ||
      !fourthNewestItem
    ) {
      throw new Error('Expected six keyed test items.')
    }

    const firstPageResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      { pageSize: KEYSET_PAGE_SIZE }
    )

    if (!firstPageResult.isSuccess || !firstPageResult.nextCursor) {
      throw new Error('Expected page 1 to have a next cursor.')
    }

    expect(firstPageResult.itemList.map((queueItem) => queueItem.id)).toEqual([
      newestItem.id,
      secondNewestItem.id,
    ])

    const secondPageResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      {
        cursorToken: firstPageResult.nextCursor,
        pageSize: KEYSET_PAGE_SIZE,
      }
    )

    if (!secondPageResult.isSuccess || !secondPageResult.nextCursor) {
      throw new Error('Expected page 2 to have a next cursor.')
    }

    expect(secondPageResult.itemList.map((queueItem) => queueItem.id)).toEqual([
      thirdNewestItem.id,
      fourthNewestItem.id,
    ])

    const thirdPageResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      {
        cursorToken: secondPageResult.nextCursor,
        pageSize: KEYSET_PAGE_SIZE,
      }
    )

    if (!thirdPageResult.isSuccess || !thirdPageResult.prevCursor) {
      throw new Error('Expected page 3 to have a previous cursor.')
    }

    const previousPageResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      {
        beforeToken: thirdPageResult.prevCursor,
        pageSize: KEYSET_PAGE_SIZE,
      }
    )

    expect(previousPageResult.isSuccess).toBe(true)

    if (!previousPageResult.isSuccess) {
      throw new Error('Expected the before cursor to load page 2.')
    }

    expect(previousPageResult.itemList.map((queueItem) => queueItem.id)).toEqual(
      [thirdNewestItem.id, fourthNewestItem.id]
    )
  })

  it('filters by pending and does not let a claimed row shift a later pending page', async () => {
    const oldestPendingItem = await createQueuedItem(
      'R4 keyset pending oldest',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 1000)
    )
    const olderPendingItem = await createQueuedItem(
      'R4 keyset pending older',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 2000)
    )
    const newerPendingItem = await createQueuedItem(
      'R4 keyset pending newer',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 3000)
    )
    const newestPendingItem = await createQueuedItem(
      'R4 keyset pending newest',
      new Date(KEYSET_CREATED_AT_BASE.getTime() + 4000)
    )

    const firstPendingPageResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      { pageSize: KEYSET_PAGE_SIZE, statusFilter: 'pending' }
    )

    expect(firstPendingPageResult.isSuccess).toBe(true)

    if (!firstPendingPageResult.isSuccess) {
      throw new Error('Expected the first pending page to load.')
    }

    expect(
      firstPendingPageResult.itemList.map((queueItem) => queueItem.id)
    ).toEqual([newestPendingItem.id, newerPendingItem.id])
    expect(
      firstPendingPageResult.itemList.every(
        (queueItem) => queueItem.status === 'pending'
      )
    ).toBe(true)

    await setupClient.item.update({
      where: { id: newestPendingItem.id },
      data: {
        status: 'CLAIMED',
        claimedById: BOB_USER_ID,
        claimedAt: new Date(),
      },
    })

    const secondPendingPageResult = await fetchQueuePageWithClient(
      setupClient,
      SUPPORT_WORKSPACE_ID,
      {
        cursorToken: firstPendingPageResult.nextCursor ?? undefined,
        pageSize: KEYSET_PAGE_SIZE,
        statusFilter: 'pending',
      }
    )

    expect(secondPendingPageResult.isSuccess).toBe(true)

    if (!secondPendingPageResult.isSuccess) {
      throw new Error('Expected the second pending page to load.')
    }

    expect(
      secondPendingPageResult.itemList.map((queueItem) => queueItem.id)
    ).toEqual([olderPendingItem.id, oldestPendingItem.id])
    expect(
      secondPendingPageResult.itemList.map((queueItem) => queueItem.id)
    ).not.toContain(newestPendingItem.id)
  })
})
