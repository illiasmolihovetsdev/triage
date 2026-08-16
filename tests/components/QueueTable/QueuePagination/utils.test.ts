import { describe, expect, it } from 'vitest'
import {
  getNextPageHref,
  getPreviousPageHref,
  getQueuePageNumberList,
  getTotalPageCount,
} from '@/components/QueueTable/QueuePagination/utils'

describe('getTotalPageCount', () => {
  it('rounds up by page size', () => {
    expect(getTotalPageCount(8600, 50)).toBe(172)
    expect(getTotalPageCount(50, 50)).toBe(1)
    expect(getTotalPageCount(0, 50)).toBe(1)
  })
})

describe('queue page hrefs', () => {
  it('builds next from the after cursor', () => {
    expect(getNextPageHref(2, 'next-token')).toBe(
      '/queue?cursor=next-token&page=3'
    )
    expect(getNextPageHref(2, null)).toBeNull()
  })

  it('uses /queue for page 2 previous and a before cursor after that', () => {
    expect(getPreviousPageHref(1, 'prev-token')).toBeNull()
    expect(getPreviousPageHref(2, 'prev-token')).toBe('/queue')
    expect(getPreviousPageHref(3, 'prev-token')).toBe(
      '/queue?before=prev-token&page=2'
    )
  })
})

describe('getQueuePageNumberList', () => {
  it('shows 1 as current and 2 as next on the first page', () => {
    expect(
      getQueuePageNumberList({
        currentPage: 1,
        totalPages: 172,
        previousHref: null,
        nextHref: '/queue?cursor=a&page=2',
      })
    ).toEqual([
      { kind: 'page', pageNumber: 1, href: null, isCurrent: true },
      {
        kind: 'page',
        pageNumber: 2,
        href: '/queue?cursor=a&page=2',
        isCurrent: false,
      },
    ])
  })

  it('shows 1, 2, and 3 on the second page', () => {
    expect(
      getQueuePageNumberList({
        currentPage: 2,
        totalPages: 172,
        previousHref: '/queue',
        nextHref: '/queue?cursor=b&page=3',
      })
    ).toEqual([
      { kind: 'page', pageNumber: 1, href: '/queue', isCurrent: false },
      { kind: 'page', pageNumber: 2, href: null, isCurrent: true },
      {
        kind: 'page',
        pageNumber: 3,
        href: '/queue?cursor=b&page=3',
        isCurrent: false,
      },
    ])
  })

  it('inserts an ellipsis after page 1 when the current page is past 3', () => {
    expect(
      getQueuePageNumberList({
        currentPage: 5,
        totalPages: 172,
        previousHref: '/queue?before=c&page=4',
        nextHref: '/queue?cursor=d&page=6',
      })
    ).toEqual([
      { kind: 'page', pageNumber: 1, href: '/queue', isCurrent: false },
      { kind: 'ellipsis' },
      {
        kind: 'page',
        pageNumber: 4,
        href: '/queue?before=c&page=4',
        isCurrent: false,
      },
      { kind: 'page', pageNumber: 5, href: null, isCurrent: true },
      {
        kind: 'page',
        pageNumber: 6,
        href: '/queue?cursor=d&page=6',
        isCurrent: false,
      },
    ])
  })
})
