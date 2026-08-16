'use client'

import { QueuePagination } from '@/components/QueueTable/QueuePagination'
import { QueueRow } from '@/components/QueueTable/QueueRow'
import { useQueueActions } from '@/components/QueueTable/hooks'
import type { QueueTableProps } from '@/components/QueueTable/types'
import { getQueueCountLabel } from '@/components/QueueTable/utils'

export const QueueTable = ({
  itemList: initialItemList,
  shownCount,
  totalCount,
  currentUserId,
  canClaim,
  canResolve,
  canRelease,
  pagination,
}: QueueTableProps) => {
  const {
    itemList,
    getRowState,
    handleClaim,
    handleResolve,
    handleRelease,
  } = useQueueActions(initialItemList)
  const countLabel = getQueueCountLabel(shownCount, totalCount)

  if (itemList.length === 0) {
    return (
      <p className="border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-600">
        No items in this workspace.
      </p>
    )
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
        {countLabel}
      </h2>
      <QueuePagination {...pagination} />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-4 font-medium">Title</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Claimer</th>
            <th className="py-2 pr-4 font-medium">Notification</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {itemList.map((queueItem) => (
            <QueueRow
              key={queueItem.id}
              queueItem={queueItem}
              rowState={getRowState(queueItem.id)}
              currentUserId={currentUserId}
              canClaim={canClaim}
              canResolve={canResolve}
              canRelease={canRelease}
              onClaim={handleClaim}
              onResolve={handleResolve}
              onRelease={handleRelease}
            />
          ))}
        </tbody>
      </table>
    </section>
  )
}
