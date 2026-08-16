import Link from 'next/link'
import type { QueuePaginationProps } from '@/components/QueueTable/QueuePagination/types'
import {
  getNextPageHref,
  getPreviousPageHref,
  getQueueListHref,
  getQueuePageNumberList,
} from '@/components/QueueTable/QueuePagination/utils'

export const QueuePagination = ({
  currentPage,
  totalPages,
  nextCursor,
  prevCursor,
  statusFilter,
}: QueuePaginationProps) => {
  const nextPageHref = getNextPageHref(currentPage, nextCursor, statusFilter)
  const previousPageHref = getPreviousPageHref(
    currentPage,
    prevCursor,
    statusFilter
  )
  const firstPageHref = getQueueListHref({ statusFilter })
  const pageNumberList = getQueuePageNumberList({
    currentPage,
    totalPages,
    firstPageHref,
    previousHref: previousPageHref,
    nextHref: nextPageHref,
  })

  if (totalPages <= 1) {
    return null
  }

  return (
    <nav
      aria-label="Queue pages"
      className="mb-3 flex flex-wrap items-center gap-2 text-sm"
    >
      {previousPageHref ? (
        <Link href={previousPageHref} className="underline">
          Previous
        </Link>
      ) : (
        <span className="text-zinc-400">Previous</span>
      )}
      {pageNumberList.map((pageNumberItem, pageNumberIndex) => {
        if (pageNumberItem.kind === 'ellipsis') {
          return (
            <span
              key={`ellipsis-${pageNumberIndex}`}
              className="px-1 text-zinc-500"
            >
              …
            </span>
          )
        }

        if (pageNumberItem.isCurrent || pageNumberItem.href === null) {
          return (
            <span
              key={pageNumberItem.pageNumber}
              aria-current={pageNumberItem.isCurrent ? 'page' : undefined}
              className="border border-zinc-400 px-2 py-0.5 font-semibold text-zinc-900"
            >
              {pageNumberItem.pageNumber}
            </span>
          )
        }

        return (
          <Link
            key={pageNumberItem.pageNumber}
            href={pageNumberItem.href}
            className="border border-zinc-300 px-2 py-0.5 text-zinc-900 hover:bg-zinc-100"
          >
            {pageNumberItem.pageNumber}
          </Link>
        )
      })}
      {nextPageHref ? (
        <Link href={nextPageHref} className="underline">
          Next
        </Link>
      ) : (
        <span className="text-zinc-400">Next</span>
      )}
    </nav>
  )
}
