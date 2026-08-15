import type { FetchClaimItemResult } from '@/services/items/types'
import { isQueueItem } from '@/services/items/parseQueueItem'
import type { ClaimHolder } from '@/types/item'
import { readErrorMessage } from '@/utils/http'

/*
 * Browser-to-server claim. Lives in its own file so a Client Component can
 * import it without pulling in prisma via services/items/index.ts.
 */

const isClaimHolder = (value: unknown): value is ClaimHolder =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'name' in value &&
  typeof value.id === 'string' &&
  typeof value.name === 'string'

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
