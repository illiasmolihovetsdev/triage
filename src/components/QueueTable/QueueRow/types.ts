import type { QueueItem } from '@/types/item'
import type { QueueRowState } from '@/components/QueueTable/types'

export interface QueueRowProps {
  queueItem: QueueItem
  rowState: QueueRowState
  currentUserId: string
  canClaim: boolean
  canResolve: boolean
  canRelease: boolean
  onClaim: (itemId: string) => void
  onResolve: (itemId: string) => void
  onRelease: (itemId: string) => void
}
