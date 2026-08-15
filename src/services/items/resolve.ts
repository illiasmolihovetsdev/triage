import 'server-only'

import type { ItemStatus } from '@/generated/prisma/enums'
import type { PrismaClient } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import { fetchQueueItemRecord } from '@/services/items/records'
import type { ResolveItemResult } from '@/services/items/types'
import { mapQueueItem } from '@/services/items/utils'
import type { ClaimHolder } from '@/types/item'

/*
 * Authorization already requires the caller to be the claimer. The UPDATE
 * repeats that in WHERE so a missed check still cannot resolve someone else's
 * row, or a row that is no longer CLAIMED.
 *
 * Notification is not part of this write. R3 records the attempt in the same
 * transaction as resolve; until then a resolve is a status change only.
 */
const getResolveConflictMessage = (
  status: ItemStatus,
  claimedBy: ClaimHolder | null
): string => {
  if (status === 'RESOLVED') {
    return 'This item is already resolved.'
  }

  if (status === 'PENDING') {
    return 'This item is no longer claimed.'
  }

  return claimedBy
    ? `Already claimed by ${claimedBy.name}.`
    : 'This item is no longer available to resolve.'
}

const createNotFoundResult = (): ResolveItemResult => ({
  isSuccess: false,
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'Item not found.',
})

export const resolveItemWithClient = async (
  database: PrismaClient,
  itemId: string,
  userId: string
): Promise<ResolveItemResult> => {
  const updateResult = await database.item.updateMany({
    where: { id: itemId, status: 'CLAIMED', claimedById: userId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
  })

  if (updateResult.count === 1) {
    const resolvedItemRecord = await fetchQueueItemRecord(database, itemId)

    if (!resolvedItemRecord) {
      return createNotFoundResult()
    }

    return { isSuccess: true, item: mapQueueItem(resolvedItemRecord) }
  }

  const currentItem = await database.item.findUnique({
    where: { id: itemId },
    select: {
      status: true,
      claimedById: true,
      claimedBy: { select: { id: true, name: true } },
    },
  })

  if (!currentItem) {
    return createNotFoundResult()
  }

  /*
   * A lost 200 can be retried. RESOLVED still names this caller as claimer, so
   * the second request must succeed rather than 409 against the same resolve.
   */
  if (
    currentItem.status === 'RESOLVED' &&
    currentItem.claimedById === userId
  ) {
    const resolvedItemRecord = await fetchQueueItemRecord(database, itemId)

    if (!resolvedItemRecord) {
      return createNotFoundResult()
    }

    return { isSuccess: true, item: mapQueueItem(resolvedItemRecord) }
  }

  const currentItemRecord = await fetchQueueItemRecord(database, itemId)

  return {
    isSuccess: false,
    statusCode: 409,
    code: 'RESOLVE_CONFLICT',
    message: getResolveConflictMessage(
      currentItem.status,
      currentItem.claimedBy
    ),
    item: currentItemRecord ? mapQueueItem(currentItemRecord) : null,
  }
}

export const resolveItem = (
  itemId: string,
  userId: string
): Promise<ResolveItemResult> => resolveItemWithClient(prisma, itemId, userId)
