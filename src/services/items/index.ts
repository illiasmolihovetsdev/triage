import 'server-only'

import { prisma } from '@/lib/db'
import { QUEUE_ITEM_SELECT, type QueuePageResult } from '@/services/items/types'
import { mapQueueItem } from '@/services/items/utils'
import type { ItemAuthRecord } from '@/types/authz'
import { QUEUE_PAGE_SIZE } from '@/types/item'

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

/*
 * First page of the caller's workspace only. The workspace ID is an argument
 * from requireCallerMembership, not from the request. The cap is intentional:
 * this is not pagination, it is a guard so 10,000 rows never reach the page.
 */
export const fetchQueuePage = async (
  workspaceId: string
): Promise<QueuePageResult> => {
  try {
    const [itemRecordList, totalCount] = await Promise.all([
      prisma.item.findMany({
        where: { workspaceId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: QUEUE_PAGE_SIZE,
        select: QUEUE_ITEM_SELECT,
      }),
      prisma.item.count({ where: { workspaceId } }),
    ])

    const itemList = itemRecordList.map(mapQueueItem)

    return {
      isSuccess: true,
      itemList,
      shownCount: itemList.length,
      totalCount,
      pageSize: QUEUE_PAGE_SIZE,
    }
  } catch {
    return {
      isSuccess: false,
      errorMessage: 'Could not load the queue.',
    }
  }
}

export { claimItem, claimItemWithClient } from '@/services/items/claim'
export { resolveItem, resolveItemWithClient } from '@/services/items/resolve'
export { releaseItem, releaseItemWithClient } from '@/services/items/release'
