'use client'

import { useState } from 'react'
import type {
  QueueRowAction,
  QueueRowState,
  UseQueueActionsResult,
} from '@/components/QueueTable/types'
import {
  applyClaimConflict,
  getIdleRowState,
  hasNotificationSettled,
  replaceQueueItem,
} from '@/components/QueueTable/utils'
import { fetchClaimItem } from '@/services/items/fetchClaim'
import {
  fetchReleaseItem,
  fetchResolveItem,
} from '@/services/items/fetchItemAction'
import { fetchQueueItem } from '@/services/items/fetchQueueItem'
import type { FetchItemActionResult } from '@/services/items/types'
import type { QueueItem } from '@/types/item'

const NOTIFICATION_POLL_INTERVAL_MS = 400
const NOTIFICATION_POLL_DEADLINE_MS = 5000

const waitForMs = (durationMs: number) =>
  new Promise<void>((settle) => {
    setTimeout(settle, durationMs)
  })

/*
 * The resolve 200 is PENDING. after() writes SENT or FAILED about a second
 * later. Poll until that outcome is stored, or stop and leave PENDING.
 */
const fetchSettledNotification = async (
  itemId: string
): Promise<QueueItem | null> => {
  const deadline = Date.now() + NOTIFICATION_POLL_DEADLINE_MS

  while (Date.now() < deadline) {
    await waitForMs(NOTIFICATION_POLL_INTERVAL_MS)

    const itemResult = await fetchQueueItem(itemId)

    if (
      itemResult.isSuccess &&
      hasNotificationSettled(itemResult.item.notificationStatus)
    ) {
      return itemResult.item
    }
  }

  return null
}

/*
 * Per-row mutation state lives here, not in the page. A lost race patches that
 * row from the response body. router.refresh() would reload the whole queue and
 * hide the conflict on the row that lost.
 */
export const useQueueActions = (
  initialItemList: QueueItem[]
): UseQueueActionsResult => {
  const [itemList, setItemList] = useState(initialItemList)
  const [rowStateByItemId, setRowStateByItemId] = useState<
    Record<string, QueueRowState>
  >({})

  const setRowLoading = (itemId: string, action: QueueRowAction) => {
    setRowStateByItemId((currentRowStateByItemId) => ({
      ...currentRowStateByItemId,
      [itemId]: { kind: 'loading', action },
    }))
  }

  const setRowIdle = (itemId: string) => {
    setRowStateByItemId((currentRowStateByItemId) => ({
      ...currentRowStateByItemId,
      [itemId]: getIdleRowState(),
    }))
  }

  const replaceItemAndIdle = (itemId: string, nextQueueItem: QueueItem) => {
    setItemList((currentItemList) =>
      replaceQueueItem(currentItemList, nextQueueItem)
    )
    setRowIdle(itemId)
  }

  const handleClaim = async (itemId: string) => {
    setRowLoading(itemId, 'claim')

    const claimResult = await fetchClaimItem(itemId)

    if (claimResult.isSuccess) {
      replaceItemAndIdle(itemId, claimResult.item)
      return
    }

    if ('code' in claimResult && claimResult.code === 'CLAIM_CONFLICT') {
      setItemList((currentItemList) =>
        currentItemList.map((queueItem) =>
          queueItem.id === itemId
            ? applyClaimConflict(queueItem, claimResult.claimedBy)
            : queueItem
        )
      )
      setRowStateByItemId((currentRowStateByItemId) => ({
        ...currentRowStateByItemId,
        [itemId]: { kind: 'conflict', message: claimResult.message },
      }))
      return
    }

    setRowStateByItemId((currentRowStateByItemId) => ({
      ...currentRowStateByItemId,
      [itemId]: {
        kind: 'error',
        message:
          'errorMessage' in claimResult
            ? claimResult.errorMessage
            : 'Could not claim this item.',
      },
    }))
  }

  const applyLifecycleResult = (
    itemId: string,
    actionResult: FetchItemActionResult,
    fallbackMessage: string
  ) => {
    if (actionResult.isSuccess) {
      replaceItemAndIdle(itemId, actionResult.item)
      return
    }

    if (
      'code' in actionResult &&
      (actionResult.code === 'RESOLVE_CONFLICT' ||
        actionResult.code === 'RELEASE_CONFLICT')
    ) {
      const currentItem = actionResult.item

      if (currentItem) {
        setItemList((currentItemList) =>
          replaceQueueItem(currentItemList, currentItem)
        )
      }

      setRowStateByItemId((currentRowStateByItemId) => ({
        ...currentRowStateByItemId,
        [itemId]: { kind: 'conflict', message: actionResult.message },
      }))
      return
    }

    setRowStateByItemId((currentRowStateByItemId) => ({
      ...currentRowStateByItemId,
      [itemId]: {
        kind: 'error',
        message:
          'errorMessage' in actionResult
            ? actionResult.errorMessage
            : fallbackMessage,
      },
    }))
  }

  const handleResolve = async (itemId: string) => {
    setRowLoading(itemId, 'resolve')
    const resolveResult = await fetchResolveItem(itemId)
    applyLifecycleResult(itemId, resolveResult, 'Could not resolve this item.')

    if (
      resolveResult.isSuccess &&
      !hasNotificationSettled(resolveResult.item.notificationStatus)
    ) {
      const settledItem = await fetchSettledNotification(itemId)

      if (settledItem) {
        setItemList((currentItemList) =>
          replaceQueueItem(currentItemList, settledItem)
        )
      }
    }
  }

  const handleRelease = async (itemId: string) => {
    setRowLoading(itemId, 'release')
    const releaseResult = await fetchReleaseItem(itemId)
    applyLifecycleResult(itemId, releaseResult, 'Could not release this item.')
  }

  const getRowState = (itemId: string): QueueRowState =>
    rowStateByItemId[itemId] ?? getIdleRowState()

  return {
    itemList,
    getRowState,
    handleClaim,
    handleResolve,
    handleRelease,
  }
}
