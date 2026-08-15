import type { ClaimHolder, QueueItem } from '@/types/item'
import type { QueueRowState } from '@/components/QueueTable/types'

export const getClaimerLabel = (queueItem: QueueItem): string =>
  queueItem.claimerName ?? '—'

export const getNotificationLabel = (queueItem: QueueItem): string =>
  queueItem.notificationStatus ?? '—'

export const getNotificationTextClassName = (queueItem: QueueItem): string =>
  queueItem.notificationStatus === 'failed' ? 'text-red-700' : 'text-zinc-700'

export const hasNotificationSettled = (
  notificationStatus: QueueItem['notificationStatus']
): boolean =>
  notificationStatus === 'sent' || notificationStatus === 'failed'

export const getQueueCountLabel = (
  shownCount: number,
  totalCount: number
): string =>
  shownCount === totalCount
    ? `${totalCount} items`
    : `Showing ${shownCount} of ${totalCount} items`

export const getIdleRowState = (): QueueRowState => ({ kind: 'idle' })

export const canShowClaimButton = (
  canClaim: boolean,
  queueItem: QueueItem
): boolean => canClaim && queueItem.status === 'pending'

export const canShowResolveButton = (
  canResolve: boolean,
  queueItem: QueueItem,
  currentUserId: string
): boolean =>
  canResolve &&
  queueItem.status === 'claimed' &&
  queueItem.claimerId === currentUserId

export const canShowReleaseButton = (
  canRelease: boolean,
  queueItem: QueueItem,
  currentUserId: string
): boolean =>
  canRelease &&
  queueItem.status === 'claimed' &&
  queueItem.claimerId === currentUserId

export const getClaimButtonLabel = (rowState: QueueRowState): string =>
  rowState.kind === 'loading' && rowState.action === 'claim'
    ? 'Claiming...'
    : 'Claim'

export const getResolveButtonLabel = (rowState: QueueRowState): string =>
  rowState.kind === 'loading' && rowState.action === 'resolve'
    ? 'Resolving...'
    : 'Resolve'

export const getReleaseButtonLabel = (rowState: QueueRowState): string =>
  rowState.kind === 'loading' && rowState.action === 'release'
    ? 'Releasing...'
    : 'Release'

export const getRowFeedbackMessage = (
  rowState: QueueRowState
): string | null => {
  if (rowState.kind === 'error' || rowState.kind === 'conflict') {
    return rowState.message
  }

  return null
}

/*
 * The 409 names who holds the item now. Patch that into the row so the table
 * tells the truth without a full refresh. A null holder means it is pending
 * again (the winner already released).
 */
export const applyClaimConflict = (
  queueItem: QueueItem,
  claimedBy: ClaimHolder | null
): QueueItem => {
  if (!claimedBy) {
    return {
      ...queueItem,
      status: 'pending',
      claimerId: null,
      claimerName: null,
    }
  }

  return {
    ...queueItem,
    status: 'claimed',
    claimerId: claimedBy.id,
    claimerName: claimedBy.name,
  }
}

export const replaceQueueItem = (
  itemList: QueueItem[],
  nextQueueItem: QueueItem
): QueueItem[] =>
  itemList.map((queueItem) =>
    queueItem.id === nextQueueItem.id ? nextQueueItem : queueItem
  )
