import type { QueuePageNumberItem } from '@/components/QueueTable/QueuePagination/types'
import type { QueueStatusFilter } from '@/types/item'

export const getTotalPageCount = (
  totalCount: number,
  pageSize: number
): number => (pageSize <= 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize)))

export const getQueueListHref = ({
  statusFilter,
  cursorToken,
  beforeToken,
  pageNumber,
}: {
  statusFilter: QueueStatusFilter
  cursorToken?: string
  beforeToken?: string
  pageNumber?: number
}): string => {
  const searchParams = new URLSearchParams()

  if (statusFilter !== 'all') {
    searchParams.set('status', statusFilter)
  }

  if (cursorToken) {
    searchParams.set('cursor', cursorToken)
  } else if (beforeToken) {
    searchParams.set('before', beforeToken)
  }

  if (pageNumber !== undefined && pageNumber > 1) {
    searchParams.set('page', String(pageNumber))
  }

  const queryString = searchParams.toString()
  return queryString.length > 0 ? `/queue?${queryString}` : '/queue'
}

export const getNextPageHref = (
  currentPage: number,
  nextCursor: string | null,
  statusFilter: QueueStatusFilter
): string | null => {
  if (!nextCursor) {
    return null
  }

  return getQueueListHref({
    statusFilter,
    cursorToken: nextCursor,
    pageNumber: currentPage + 1,
  })
}

export const getPreviousPageHref = (
  currentPage: number,
  prevCursor: string | null,
  statusFilter: QueueStatusFilter
): string | null => {
  if (currentPage <= 1) {
    return null
  }

  if (currentPage === 2) {
    return getQueueListHref({ statusFilter })
  }

  if (!prevCursor) {
    return null
  }

  return getQueueListHref({
    statusFilter,
    beforeToken: prevCursor,
    pageNumber: currentPage - 1,
  })
}

export const getQueuePageNumberList = ({
  currentPage,
  totalPages,
  firstPageHref,
  previousHref,
  nextHref,
}: {
  currentPage: number
  totalPages: number
  firstPageHref: string
  previousHref: string | null
  nextHref: string | null
}): QueuePageNumberItem[] => {
  const pageNumberList: QueuePageNumberItem[] = [
    {
      kind: 'page',
      pageNumber: 1,
      href: currentPage === 1 ? null : firstPageHref,
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
