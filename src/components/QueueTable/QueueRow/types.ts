import type { QueueItem } from '@/types/item'
import type { QueueRowState } from '@/components/QueueTable/types'

export interface QueueRowProps {
  queueItem: QueueItem
  rowState: QueueRowState
  canClaim: boolean
  onClaim: (itemId: string) => void
}
