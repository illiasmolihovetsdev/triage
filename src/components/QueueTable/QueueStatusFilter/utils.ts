import type { QueueStatusFilter } from '@/types/item'

export const QUEUE_STATUS_FILTER_LABEL: Record<QueueStatusFilter, string> = {
  all: 'All',
  pending: 'Pending',
  claimed: 'Claimed',
  resolved: 'Resolved',
}
