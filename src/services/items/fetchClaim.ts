import type { FetchClaimItemResult } from '@/services/items/types'
import type { ClaimHolder, QueueItem, QueueItemStatus } from '@/types/item'
import { readErrorMessage } from '@/utils/http'

/*
 * Browser-to-server claim. Lives in its own file so a Client Component can
 * import it without pulling in prisma via services/items/index.ts.
 */

const QUEUE_ITEM_STATUS_LIST: QueueItemStatus[] = [
  'pending',
  'claimed',
  'resolved',
]

const isClaimHolder = (value: unknown): value is ClaimHolder =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'name' in value &&
  typeof value.id === 'string' &&
  typeof value.name === 'string'

const QUEUE_NOTIFICATION_STATUS_LIST = ['pending', 'sent', 'failed'] as const

const isQueueItem = (value: unknown): value is QueueItem =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'title' in value &&
  'status' in value &&
  'claimerId' in value &&
  'claimerName' in value &&
  'notificationStatus' in value &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.status === 'string' &&
  QUEUE_ITEM_STATUS_LIST.includes(value.status as QueueItemStatus) &&
  (value.claimerId === null || typeof value.claimerId === 'string') &&
  (value.claimerName === null || typeof value.claimerName === 'string') &&
  (value.notificationStatus === null ||
    (typeof value.notificationStatus === 'string' &&
      QUEUE_NOTIFICATION_STATUS_LIST.includes(
        value.notificationStatus as (typeof QUEUE_NOTIFICATION_STATUS_LIST)[number]
      )))

const readClaimConflict = async (
  response: Response
): Promise<FetchClaimItemResult> => {
  try {
    const failureBody: unknown = await response.json()

    if (
      typeof failureBody === 'object' &&
      failureBody !== null &&
      'code' in failureBody &&
      failureBody.code === 'CLAIM_CONFLICT' &&
      'message' in failureBody &&
      typeof failureBody.message === 'string'
    ) {
      const claimedBy =
        'claimedBy' in failureBody && isClaimHolder(failureBody.claimedBy)
          ? failureBody.claimedBy
          : null

      return {
        isSuccess: false,
        code: 'CLAIM_CONFLICT',
        message: failureBody.message,
        claimedBy,
      }
    }
  } catch {
    return {
      isSuccess: false,
      errorMessage: 'Could not claim this item.',
    }
  }

  return {
    isSuccess: false,
    errorMessage: 'Could not claim this item.',
  }
}

export const fetchClaimItem = async (
  itemId: string
): Promise<FetchClaimItemResult> => {
  try {
    const response = await fetch(`/api/items/${itemId}/claim`, {
      method: 'POST',
    })

    if (response.status === 409) {
      return readClaimConflict(response)
    }

    if (!response.ok) {
      return {
        isSuccess: false,
        errorMessage: await readErrorMessage(
          response,
          'Could not claim this item.'
        ),
      }
    }

    const claimedItem: unknown = await response.json()

    if (!isQueueItem(claimedItem)) {
      return {
        isSuccess: false,
        errorMessage: 'Claim succeeded but the response was not understood.',
      }
    }

    return { isSuccess: true, item: claimedItem }
  } catch {
    return {
      isSuccess: false,
      errorMessage: 'Network error. Could not claim this item.',
    }
  }
}
