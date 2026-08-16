import 'server-only'

import type { PrismaClient } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import { fetchQueueItemRecord } from '@/services/items/records'
import type { ClaimItemResult } from '@/services/items/types'
import { mapQueueItem } from '@/services/items/utils'
import type { ClaimHolder } from '@/types/item'
import {
  getClaimExpiryThreshold,
  isClaimExpired,
} from '@/utils/claimExpiry'

/*
 * The R1 guarantee lives in this UPDATE's WHERE clause, not in an application
 * if. PostgreSQL locks the row, evaluates PENDING or an expired CLAIMED row,
 * and applies at most one of the concurrent updates. The loser matches zero
 * rows and is told who holds the item now.
 *
 * database is injectable so the concurrency test can use two connections.
 * Production always passes the process singleton.
 */
const getClaimConflictMessage = (claimedBy: ClaimHolder | null): string =>
  claimedBy
    ? `Already claimed by ${claimedBy.name}.`
    : 'This item is no longer available to claim.'

export const claimItemWithClient = async (
  database: PrismaClient,
  itemId: string,
  userId: string
): Promise<ClaimItemResult> => {
  const expiryThreshold = getClaimExpiryThreshold()
  const updateResult = await database.item.updateMany({
    where: {
      id: itemId,
      OR: [
        { status: 'PENDING' },
        { status: 'CLAIMED', claimedAt: { lt: expiryThreshold } },
      ],
    },
    data: {
      status: 'CLAIMED',
      claimedById: userId,
      claimedAt: new Date(),
    },
  })

  if (updateResult.count === 1) {
    const claimedItemRecord = await fetchQueueItemRecord(database, itemId)

    if (!claimedItemRecord) {
      return {
        isSuccess: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Item not found.',
      }
    }

    return { isSuccess: true, item: mapQueueItem(claimedItemRecord) }
  }

  const currentItem = await database.item.findUnique({
    where: { id: itemId },
    select: {
      status: true,
      claimedAt: true,
      claimedBy: { select: { id: true, name: true } },
    },
  })

  if (!currentItem) {
    return {
      isSuccess: false,
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Item not found.',
    }
  }

  /*
   * The winner's HTTP response can be lost. Retrying as the same user must
   * succeed rather than 409 against yourself, but only while the claim is
   * still fresh. An expired self-claim must match the UPDATE above so
   * claimedAt is refreshed.
   */
  if (
    currentItem.status === 'CLAIMED' &&
    currentItem.claimedBy?.id === userId &&
    !isClaimExpired(currentItem.claimedAt)
  ) {
    const claimedItemRecord = await fetchQueueItemRecord(database, itemId)

    if (!claimedItemRecord) {
      return {
        isSuccess: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Item not found.',
      }
    }

    return { isSuccess: true, item: mapQueueItem(claimedItemRecord) }
  }

  /*
   * The follow-up read is not the winning snapshot. Between matching 0 rows
   * and this SELECT, the winner might have released and someone else claimed.
   * The 409 reports who holds it now, which is what the UI needs.
   */
  return {
    isSuccess: false,
    statusCode: 409,
    code: 'CLAIM_CONFLICT',
    message: getClaimConflictMessage(currentItem.claimedBy),
    claimedBy: currentItem.claimedBy,
  }
}

export const claimItem = (
  itemId: string,
  userId: string
): Promise<ClaimItemResult> => claimItemWithClient(prisma, itemId, userId)

