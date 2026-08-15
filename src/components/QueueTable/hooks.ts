'use client'

import { useState } from 'react'
import type {
  QueueRowState,
  UseQueueClaimsResult,
} from '@/components/QueueTable/types'
import {
  applyClaimConflict,
  getIdleRowState,
  replaceQueueItem,
} from '@/components/QueueTable/utils'
import { fetchClaimItem } from '@/services/items/fetchClaim'
import type { QueueItem } from '@/types/item'

/*
 * Per-row claim state lives here, not in the page. A lost race patches that
 * row from the 409 body. router.refresh() would reload the whole queue and
 * hide the conflict on the row that lost.
 */
export const useQueueClaims = (
  initialItemList: QueueItem[]
): UseQueueClaimsResult => {
  const [itemList, setItemList] = useState(initialItemList)
  const [rowStateByItemId, setRowStateByItemId] = useState<
    Record<string, QueueRowState>
  >({})

  const handleClaim = async (itemId: string) => {
    setRowStateByItemId((currentRowStateByItemId) => ({
      ...currentRowStateByItemId,
      [itemId]: { kind: 'loading' },
    }))

    const claimResult = await fetchClaimItem(itemId)

    if (claimResult.isSuccess) {
      setItemList((currentItemList) =>
        replaceQueueItem(currentItemList, claimResult.item)
      )
      setRowStateByItemId((currentRowStateByItemId) => ({
        ...currentRowStateByItemId,
        [itemId]: getIdleRowState(),
      }))
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

  const getRowState = (itemId: string): QueueRowState =>
    rowStateByItemId[itemId] ?? getIdleRowState()

  return { itemList, getRowState, handleClaim }
}
