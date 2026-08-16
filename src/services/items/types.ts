import type { ItemStatus, NotificationStatus } from '@/generated/prisma/enums'
import type { ClaimHolder, QueueItem } from '@/types/item'

export interface QueueItemRecord {
  id: string
  title: string
  status: ItemStatus
  createdAt: Date
  claimedBy: { id: string; name: string } | null
  notificationAttempt: { status: NotificationStatus } | null
}

export const QUEUE_ITEM_SELECT = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  claimedBy: { select: { id: true, name: true } },
  notificationAttempt: { select: { status: true } },
} as const

export interface FetchQueuePageOptions {
  cursorToken?: string
  beforeToken?: string
  pageSize?: number
}

export type QueuePageResult =
  | {
      isSuccess: true
      itemList: QueueItem[]
      shownCount: number
      totalCount: number
      pageSize: number
      nextCursor: string | null
      prevCursor: string | null
      hasNextPage: boolean
      hasPreviousPage: boolean
    }
  | { isSuccess: false; errorMessage: string }

export type ClaimItemResult =
  | { isSuccess: true; item: QueueItem }
  | {
      isSuccess: false
      statusCode: 409
      code: 'CLAIM_CONFLICT'
      message: string
      claimedBy: ClaimHolder | null
    }
  | {
      isSuccess: false
      statusCode: 404
      code: 'NOT_FOUND'
      message: string
    }

export type FetchClaimItemResult =
  | { isSuccess: true; item: QueueItem }
  | {
      isSuccess: false
      code: 'CLAIM_CONFLICT'
      message: string
      claimedBy: ClaimHolder | null
    }
  | { isSuccess: false; errorMessage: string }

type ItemNotFoundResult = {
  isSuccess: false
  statusCode: 404
  code: 'NOT_FOUND'
  message: string
}

export type ResolveItemResult =
  | { isSuccess: true; item: QueueItem }
  | {
      isSuccess: false
      statusCode: 409
      code: 'RESOLVE_CONFLICT'
      message: string
      item: QueueItem | null
    }
  | ItemNotFoundResult

export type ReleaseItemResult =
  | { isSuccess: true; item: QueueItem }
  | {
      isSuccess: false
      statusCode: 409
      code: 'RELEASE_CONFLICT'
      message: string
      item: QueueItem | null
    }
  | ItemNotFoundResult

export type FetchItemActionResult =
  | { isSuccess: true; item: QueueItem }
  | {
      isSuccess: false
      code: 'RESOLVE_CONFLICT' | 'RELEASE_CONFLICT'
      message: string
      item: QueueItem | null
    }
  | { isSuccess: false; errorMessage: string }

export type FetchQueueItemResult =
  | { isSuccess: true; item: QueueItem }
  | { isSuccess: false; errorMessage: string }
