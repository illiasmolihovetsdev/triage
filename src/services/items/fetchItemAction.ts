import { isQueueItem } from '@/services/items/parseQueueItem'
import type { FetchItemActionResult } from '@/services/items/types'
import { readErrorMessage } from '@/utils/http'

type ItemLifecycleAction = 'resolve' | 'release'

const CONFLICT_CODE_BY_ACTION = {
  resolve: 'RESOLVE_CONFLICT',
  release: 'RELEASE_CONFLICT',
} as const

const FALLBACK_MESSAGE_BY_ACTION = {
  resolve: 'Could not resolve this item.',
  release: 'Could not release this item.',
} as const

const readLifecycleConflict = async (
  response: Response,
  action: ItemLifecycleAction
): Promise<FetchItemActionResult> => {
  const fallbackMessage = FALLBACK_MESSAGE_BY_ACTION[action]
  const expectedCode = CONFLICT_CODE_BY_ACTION[action]

  try {
    const failureBody: unknown = await response.json()

    if (
      typeof failureBody === 'object' &&
      failureBody !== null &&
      'code' in failureBody &&
      failureBody.code === expectedCode &&
      'message' in failureBody &&
      typeof failureBody.message === 'string'
    ) {
      const currentItem =
        'item' in failureBody && isQueueItem(failureBody.item)
          ? failureBody.item
          : null

      return {
        isSuccess: false,
        code: expectedCode,
        message: failureBody.message,
        item: currentItem,
      }
    }
  } catch {
    return {
      isSuccess: false,
      errorMessage: fallbackMessage,
    }
  }

  return {
    isSuccess: false,
    errorMessage: fallbackMessage,
  }
}

const fetchItemLifecycleAction = async (
  itemId: string,
  action: ItemLifecycleAction
): Promise<FetchItemActionResult> => {
  const fallbackMessage = FALLBACK_MESSAGE_BY_ACTION[action]

  try {
    const response = await fetch(`/api/items/${itemId}/${action}`, {
      method: 'POST',
    })

    if (response.status === 409) {
      return readLifecycleConflict(response, action)
    }

    if (!response.ok) {
      return {
        isSuccess: false,
        errorMessage: await readErrorMessage(response, fallbackMessage),
      }
    }

    const mutatedItem: unknown = await response.json()

    if (!isQueueItem(mutatedItem)) {
      return {
        isSuccess: false,
        errorMessage: `${action === 'resolve' ? 'Resolve' : 'Release'} succeeded but the response was not understood.`,
      }
    }

    return { isSuccess: true, item: mutatedItem }
  } catch {
    return {
      isSuccess: false,
      errorMessage: `Network error. ${fallbackMessage}`,
    }
  }
}

export const fetchResolveItem = (
  itemId: string
): Promise<FetchItemActionResult> => fetchItemLifecycleAction(itemId, 'resolve')

export const fetchReleaseItem = (
  itemId: string
): Promise<FetchItemActionResult> => fetchItemLifecycleAction(itemId, 'release')
