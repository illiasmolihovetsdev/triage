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
  replaceQueueItem,
} from '@/components/QueueTable/utils'
import { fetchClaimItem } from '@/services/items/fetchClaim'
import {
  fetchReleaseItem,
  fetchResolveItem,
} from '@/services/items/fetchItemAction'
import type { FetchItemActionResult } from '@/services/items/types'
import type { QueueItem } from '@/types/item'

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
