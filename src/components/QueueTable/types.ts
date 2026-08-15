import type { QueueItem } from '@/types/item'

export interface QueueTableProps {
  itemList: QueueItem[]
  shownCount: number
  totalCount: number
  currentUserId: string
  canClaim: boolean
  canResolve: boolean
  canRelease: boolean
}

export type QueueRowAction = 'claim' | 'resolve' | 'release'

export type QueueRowState =
  | { kind: 'idle' }
  | { kind: 'loading'; action: QueueRowAction }
  | { kind: 'error'; message: string }
  | { kind: 'conflict'; message: string }

export interface UseQueueActionsResult {
  itemList: QueueItem[]
  getRowState: (itemId: string) => QueueRowState
  handleClaim: (itemId: string) => void
  handleResolve: (itemId: string) => void
  handleRelease: (itemId: string) => void
}
