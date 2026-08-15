import type { FetchQueueItemResult } from '@/services/items/types'
import { isQueueItem } from '@/services/items/parseQueueItem'
import { readErrorMessage } from '@/utils/http'

/*
 * Browser-to-server read of one queue item. Separate from services/items so a
 * Client Component never imports Prisma.
 */
export const fetchQueueItem = async (
  itemId: string
): Promise<FetchQueueItemResult> => {
  try {
    const response = await fetch(`/api/items/${itemId}`, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        isSuccess: false,
        errorMessage: await readErrorMessage(
          response,
          'Could not load this item.'
        ),
      }
    }

    const queueItem: unknown = await response.json()

    if (!isQueueItem(queueItem)) {
      return {
        isSuccess: false,
        errorMessage: 'The item response was not understood.',
      }
    }

    return { isSuccess: true, item: queueItem }
  } catch {
    return {
      isSuccess: false,
      errorMessage: 'Network error. Could not load this item.',
    }
  }
}
