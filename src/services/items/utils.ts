import type { QueueItemRecord } from '@/services/items/types'
import type {
  QueueItem,
  QueueItemStatus,
  QueueNotificationStatus,
} from '@/types/item'

export const mapQueueItem = (itemRecord: QueueItemRecord): QueueItem => ({
  id: itemRecord.id,
  title: itemRecord.title,
  status: itemRecord.status.toLowerCase() as QueueItemStatus,
  claimerName: itemRecord.claimedBy?.name ?? null,
  notificationStatus: itemRecord.notificationAttempt
    ? (itemRecord.notificationAttempt.status.toLowerCase() as QueueNotificationStatus)
    : null,
})
