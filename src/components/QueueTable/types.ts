import type { QueueItem } from '@/types/item'

export interface QueueTableProps {
  itemList: QueueItem[]
  shownCount: number
  totalCount: number
  canClaim: boolean
}

export type QueueRowState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; message: string }

export interface UseQueueClaimsResult {
  itemList: QueueItem[]
  getRowState: (itemId: string) => QueueRowState
  handleClaim: (itemId: string) => void
}
