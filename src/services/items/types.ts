import type { ItemStatus, NotificationStatus } from '@/generated/prisma/enums'
import type { QueueItem } from '@/types/item'

export interface QueueItemRecord {
  id: string
  title: string
  status: ItemStatus
  claimedBy: { name: string } | null
  notificationAttempt: { status: NotificationStatus } | null
}

export type QueuePageResult =
  | {
      isSuccess: true
      itemList: QueueItem[]
      shownCount: number
      totalCount: number
      pageSize: number
    }
  | { isSuccess: false; errorMessage: string }
