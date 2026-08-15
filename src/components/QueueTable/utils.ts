import type { QueueItem } from '@/types/item'

export const getClaimerLabel = (queueItem: QueueItem): string =>
  queueItem.claimerName ?? '—'

export const getNotificationLabel = (queueItem: QueueItem): string =>
  queueItem.notificationStatus ?? '—'

export const getQueueCountLabel = (
  shownCount: number,
  totalCount: number
): string =>
  shownCount === totalCount
    ? `${totalCount} items`
    : `Showing ${shownCount} of ${totalCount} items`
