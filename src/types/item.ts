import type { ItemStatus, NotificationStatus } from '@/generated/prisma/enums'

export type QueueItemStatus = Lowercase<ItemStatus>
export type QueueNotificationStatus = Lowercase<NotificationStatus>
export type QueueStatusFilter = 'all' | QueueItemStatus

export const QUEUE_STATUS_FILTER_LIST: readonly QueueStatusFilter[] = [
  'all',
  'pending',
  'claimed',
  'resolved',
]

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
