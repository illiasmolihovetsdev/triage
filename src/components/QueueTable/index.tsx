import {
  getClaimerLabel,
  getNotificationLabel,
  getQueueCountLabel,
} from '@/components/QueueTable/utils'
import type { QueueTableProps } from '@/components/QueueTable/types'

export const QueueTable = ({
  itemList,
  shownCount,
  totalCount,
}: QueueTableProps) => {
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
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
          <th className="py-2 pr-4 font-medium">Title</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 pr-4 font-medium">Claimer</th>
          <th className="py-2 font-medium">Notification</th>
        </tr>
      </thead>
      <tbody>
        {itemList.map((queueItem) => (
          <tr key={queueItem.id} className="border-b border-zinc-200">
            <td className="py-2 pr-4 text-zinc-900">{queueItem.title}</td>
            <td className="py-2 pr-4 text-zinc-700">{queueItem.status}</td>
            <td className="py-2 pr-4 text-zinc-700">
              {getClaimerLabel(queueItem)}
            </td>
            <td className="py-2 text-zinc-700">
              {getNotificationLabel(queueItem)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </section>
  )
}
