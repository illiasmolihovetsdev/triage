import 'server-only'

import { prisma } from '@/lib/db'
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
