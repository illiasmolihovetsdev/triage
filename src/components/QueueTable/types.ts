import type { QueueItem } from '@/types/item'

export interface QueueTableProps {
  itemList: QueueItem[]
  shownCount: number
  totalCount: number
}
