export type QueuePageNumberItem =
  | { kind: 'ellipsis' }
  | {
      kind: 'page'
      pageNumber: number
      href: string | null
      isCurrent: boolean
    }

export interface QueuePaginationProps {
  currentPage: number
  totalPages: number
  nextCursor: string | null
  prevCursor: string | null
}
