import type { ItemStatus, NotificationStatus } from '@/generated/prisma/enums'

export type QueueItemStatus = Lowercase<ItemStatus>
export type QueueNotificationStatus = Lowercase<NotificationStatus>

export interface QueueItem {
  id: string
  title: string
  status: QueueItemStatus
  claimerId: string | null
  claimerName: string | null
  notificationStatus: QueueNotificationStatus | null
}

export interface ClaimHolder {
  id: string
  name: string
}

export const QUEUE_PAGE_SIZE = 50
