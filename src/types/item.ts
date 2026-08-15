import type { ItemStatus, NotificationStatus } from '@/generated/prisma/enums'

export type QueueItemStatus = Lowercase<ItemStatus>
export type QueueNotificationStatus = Lowercase<NotificationStatus>

export interface QueueItem {
  id: string
  title: string
  status: QueueItemStatus
  claimerName: string | null
  notificationStatus: QueueNotificationStatus | null
}

export const QUEUE_PAGE_SIZE = 50
