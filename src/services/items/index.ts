import 'server-only'

import { prisma } from '@/lib/db'
import { fetchQueueItemRecord } from '@/services/items/records'
import type { FetchQueueItemResult } from '@/services/items/types'
import { mapQueueItem } from '@/services/items/utils'
import type { ItemAuthRecord } from '@/types/authz'

/*
 * Loads the fields authorization needs and nothing else. The workspace comes
 * from this row, never from a client-supplied workspace ID.
 */
export const fetchItemAuthRecord = async (
  itemId: string
): Promise<ItemAuthRecord | null> => {
  const itemRecord = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, workspaceId: true, claimedById: true },
  })

  return itemRecord
}

export {
  fetchQueuePage,
  fetchQueuePageWithClient,
} from '@/services/items/queuePage'
export { claimItem, claimItemWithClient } from '@/services/items/claim'
export { resolveItem, resolveItemWithClient } from '@/services/items/resolve'
export { releaseItem, releaseItemWithClient } from '@/services/items/release'

export const fetchQueueItemById = async (
  itemId: string
): Promise<FetchQueueItemResult> => {
  try {
    const itemRecord = await fetchQueueItemRecord(prisma, itemId)

    if (!itemRecord) {
      return {
        isSuccess: false,
        errorMessage: 'Item not found.',
      }
    }

    return { isSuccess: true, item: mapQueueItem(itemRecord) }
  } catch {
    return {
      isSuccess: false,
      errorMessage: 'Could not load this item.',
    }
  }
}
