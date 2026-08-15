import 'server-only'

import type { ItemStatus } from '@/generated/prisma/enums'
import type { PrismaClient } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import { fetchQueueItemRecord } from '@/services/items/records'
import type { ReleaseItemResult } from '@/services/items/types'
import { mapQueueItem } from '@/services/items/utils'
import type { ClaimHolder } from '@/types/item'

/*
 * Authorization already requires the caller to be the claimer. The UPDATE
 * repeats that in WHERE so a missed check still cannot release someone else's
 * claim. PENDING clears claimant and claimedAt together; the CHECK constraint
 * rejects a half-cleared row.
 */
const getReleaseConflictMessage = (
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
    : 'This item is no longer available to release.'
}

const createNotFoundResult = (): ReleaseItemResult => ({
  isSuccess: false,
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'Item not found.',
})

export const releaseItemWithClient = async (
  database: PrismaClient,
  itemId: string,
  userId: string
): Promise<ReleaseItemResult> => {
  const updateResult = await database.item.updateMany({
    where: { id: itemId, status: 'CLAIMED', claimedById: userId },
    data: {
      status: 'PENDING',
      claimedById: null,
      claimedAt: null,
    },
  })

  if (updateResult.count === 1) {
    const releasedItemRecord = await fetchQueueItemRecord(database, itemId)

    if (!releasedItemRecord) {
      return createNotFoundResult()
    }

    return { isSuccess: true, item: mapQueueItem(releasedItemRecord) }
  }

  const currentItem = await database.item.findUnique({
    where: { id: itemId },
    select: {
      status: true,
      claimedBy: { select: { id: true, name: true } },
    },
  })

  if (!currentItem) {
    return createNotFoundResult()
  }

  const currentItemRecord = await fetchQueueItemRecord(database, itemId)

  return {
    isSuccess: false,
    statusCode: 409,
    code: 'RELEASE_CONFLICT',
    message: getReleaseConflictMessage(
      currentItem.status,
      currentItem.claimedBy
    ),
    item: currentItemRecord ? mapQueueItem(currentItemRecord) : null,
  }
}

export const releaseItem = (
  itemId: string,
  userId: string
): Promise<ReleaseItemResult> => releaseItemWithClient(prisma, itemId, userId)
