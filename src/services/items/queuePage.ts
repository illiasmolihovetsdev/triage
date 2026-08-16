import 'server-only'

import type { PrismaClient } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import {
  decodeQueueCursor,
  encodeQueueCursor,
  getQueuePageWindow,
  type QueueCursor,
} from '@/services/items/queueCursor'
import type {
  FetchQueuePageOptions,
  QueueItemRecord,
  QueuePageResult,
} from '@/services/items/types'
import { QUEUE_ITEM_SELECT } from '@/services/items/types'
import { mapQueueItem } from '@/services/items/utils'
import { QUEUE_PAGE_SIZE } from '@/types/item'

/*
 * Keyset, not OFFSET. Later pages seek on (createdAt, id), so a claim or
 * resolve on an earlier row cannot shift them. createdAt and id do not change
 * on those writes. An invalid cursor is treated as page 1 rather than failing
 * the queue.
 *
 * `cursor` is "older than this row" (Next). `before` is "the page immediately
 * newer than this row" (Previous). workspaceId comes from
 * requireCallerMembership, never from the cursor.
 */
const getQueuePageWhereAfter = (
  workspaceId: string,
  cursor: QueueCursor | null
) => {
  if (!cursor) {
    return { workspaceId }
  }

  return {
    workspaceId,
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        id: { lt: cursor.id },
      },
    ],
  }
}

const getQueuePageWhereBefore = (workspaceId: string, cursor: QueueCursor) => ({
  workspaceId,
  OR: [
    { createdAt: { gt: cursor.createdAt } },
    {
      createdAt: cursor.createdAt,
      id: { gt: cursor.id },
    },
  ],
})

const encodeRecordCursor = (itemRecord: QueueItemRecord | undefined) =>
  itemRecord
    ? encodeQueueCursor({
        createdAt: itemRecord.createdAt,
        id: itemRecord.id,
      })
    : null

const createSuccessResult = (
  pageRecordList: QueueItemRecord[],
  totalCount: number,
  pageSize: number,
  hasNextPage: boolean,
  hasPreviousPage: boolean
): QueuePageResult => {
  const firstRecord = pageRecordList[0]
  const lastRecord = pageRecordList[pageRecordList.length - 1]

  return {
    isSuccess: true,
    itemList: pageRecordList.map(mapQueueItem),
    shownCount: pageRecordList.length,
    totalCount,
    pageSize,
    nextCursor: hasNextPage ? encodeRecordCursor(lastRecord) : null,
    prevCursor: hasPreviousPage ? encodeRecordCursor(firstRecord) : null,
    hasNextPage,
    hasPreviousPage,
  }
}

export const fetchQueuePageWithClient = async (
  database: PrismaClient,
  workspaceId: string,
  options: FetchQueuePageOptions = {}
): Promise<QueuePageResult> => {
  try {
    const pageSize = options.pageSize ?? QUEUE_PAGE_SIZE
    const afterCursor = options.cursorToken
      ? decodeQueueCursor(options.cursorToken)
      : null
    const beforeCursor =
      afterCursor || !options.beforeToken
        ? null
        : decodeQueueCursor(options.beforeToken)

    if (beforeCursor) {
      const [oldestFirstRecordList, totalCount] = await Promise.all([
        database.item.findMany({
          where: getQueuePageWhereBefore(workspaceId, beforeCursor),
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: pageSize + 1,
          select: QUEUE_ITEM_SELECT,
        }),
        database.item.count({ where: { workspaceId } }),
      ])

      const { pageRecordList: oldestFirstPage, hasNextPage: hasPreviousPage } =
        getQueuePageWindow(oldestFirstRecordList, pageSize)

      return createSuccessResult(
        oldestFirstPage.toReversed(),
        totalCount,
        pageSize,
        true,
        hasPreviousPage
      )
    }

    const [itemRecordList, totalCount] = await Promise.all([
      database.item.findMany({
        where: getQueuePageWhereAfter(workspaceId, afterCursor),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pageSize + 1,
        select: QUEUE_ITEM_SELECT,
      }),
      database.item.count({ where: { workspaceId } }),
    ])

    const { pageRecordList, hasNextPage } = getQueuePageWindow(
      itemRecordList,
      pageSize
    )

    return createSuccessResult(
      pageRecordList,
      totalCount,
      pageSize,
      hasNextPage,
      afterCursor !== null
    )
  } catch {
    return {
      isSuccess: false,
      errorMessage: 'Could not load the queue.',
    }
  }
}

export const fetchQueuePage = (
  workspaceId: string,
  options: FetchQueuePageOptions = {}
): Promise<QueuePageResult> =>
  fetchQueuePageWithClient(prisma, workspaceId, options)
