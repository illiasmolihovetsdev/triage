import Link from 'next/link'
import { getQueueListHref } from '@/components/QueueTable/QueuePagination/utils'
import type { QueueStatusFilterProps } from '@/components/QueueTable/QueueStatusFilter/types'
import { QUEUE_STATUS_FILTER_LABEL } from '@/components/QueueTable/QueueStatusFilter/utils'
import { QUEUE_STATUS_FILTER_LIST } from '@/types/item'

export const QueueStatusFilter = ({
  currentFilter,
}: QueueStatusFilterProps) => (
  <nav aria-label="Queue status" className="mb-3 flex flex-wrap gap-2 text-sm">
    {QUEUE_STATUS_FILTER_LIST.map((statusFilter) => {
      const filterLabel = QUEUE_STATUS_FILTER_LABEL[statusFilter]

      if (statusFilter === currentFilter) {
        return (
          <span
            key={statusFilter}
            aria-current="page"
            className="border border-zinc-400 px-2 py-0.5 font-semibold text-zinc-900"
          >
            {filterLabel}
          </span>
        )
      }

      return (
        <Link
          key={statusFilter}
          href={getQueueListHref({ statusFilter })}
          className="border border-zinc-300 px-2 py-0.5 text-zinc-900 hover:bg-zinc-100"
        >
          {filterLabel}
        </Link>
      )
    })}
  </nav>
)
