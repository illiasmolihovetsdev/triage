import type { QueuePageNumberItem } from '@/components/QueueTable/QueuePagination/types'

export const getTotalPageCount = (
  totalCount: number,
  pageSize: number
): number => (pageSize <= 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize)))

export const getNextPageHref = (
  currentPage: number,
  nextCursor: string | null
): string | null => {
  if (!nextCursor) {
    return null
  }

  return `/queue?cursor=${encodeURIComponent(nextCursor)}&page=${currentPage + 1}`
}

export const getPreviousPageHref = (
  currentPage: number,
  prevCursor: string | null
): string | null => {
  if (currentPage <= 1) {
    return null
  }

  if (currentPage === 2) {
    return '/queue'
  }

  if (!prevCursor) {
    return null
  }

  return `/queue?before=${encodeURIComponent(prevCursor)}&page=${currentPage - 1}`
}

export const getQueuePageNumberList = ({
  currentPage,
  totalPages,
  previousHref,
  nextHref,
}: {
  currentPage: number
  totalPages: number
  previousHref: string | null
  nextHref: string | null
}): QueuePageNumberItem[] => {
  const pageNumberList: QueuePageNumberItem[] = [
    {
      kind: 'page',
      pageNumber: 1,
      href: currentPage === 1 ? null : '/queue',
      isCurrent: currentPage === 1,
    },
  ]

  if (currentPage > 2) {
    if (currentPage > 3) {
      pageNumberList.push({ kind: 'ellipsis' })
    }

    pageNumberList.push({
      kind: 'page',
      pageNumber: currentPage - 1,
      href: previousHref,
      isCurrent: false,
    })
  }

  if (currentPage !== 1) {
    pageNumberList.push({
      kind: 'page',
      pageNumber: currentPage,
      href: null,
      isCurrent: true,
    })
  }

  if (currentPage < totalPages) {
    pageNumberList.push({
      kind: 'page',
      pageNumber: currentPage + 1,
      href: nextHref,
      isCurrent: false,
    })
  }

  return pageNumberList
}
