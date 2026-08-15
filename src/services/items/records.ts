import 'server-only'

import type { PrismaClient } from '@/generated/prisma/client'
import { QUEUE_ITEM_SELECT } from '@/services/items/types'

export const fetchQueueItemRecord = (database: PrismaClient, itemId: string) =>
  database.item.findUnique({
    where: { id: itemId },
    select: QUEUE_ITEM_SELECT,
  })
