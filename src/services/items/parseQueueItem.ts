import type { QueueItem, QueueItemStatus } from '@/types/item'

const QUEUE_ITEM_STATUS_LIST: QueueItemStatus[] = [
  'pending',
  'claimed',
  'resolved',
]

const QUEUE_NOTIFICATION_STATUS_LIST = ['pending', 'sent', 'failed'] as const

export const isQueueItem = (value: unknown): value is QueueItem =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  'title' in value &&
  'status' in value &&
  'claimerId' in value &&
  'claimerName' in value &&
  'notificationStatus' in value &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.status === 'string' &&
  QUEUE_ITEM_STATUS_LIST.includes(value.status as QueueItemStatus) &&
  (value.claimerId === null || typeof value.claimerId === 'string') &&
  (value.claimerName === null || typeof value.claimerName === 'string') &&
  (value.notificationStatus === null ||
    (typeof value.notificationStatus === 'string' &&
      QUEUE_NOTIFICATION_STATUS_LIST.includes(
        value.notificationStatus as (typeof QUEUE_NOTIFICATION_STATUS_LIST)[number]
      )))
