import { describe, expect, it } from 'vitest'
import {
  decodeQueueCursor,
  encodeQueueCursor,
  getQueuePageWindow,
} from '@/services/items/queueCursor'

describe('queue cursor', () => {
  it('round-trips createdAt and id', () => {
    const cursor = {
      createdAt: new Date('2026-08-16T12:00:00.123Z'),
      id: 'item_abc',
    }

    expect(decodeQueueCursor(encodeQueueCursor(cursor))).toEqual(cursor)
  })

  it('rejects a token that is not a cursor', () => {
    expect(decodeQueueCursor('not-a-cursor')).toBeNull()
    expect(decodeQueueCursor('')).toBeNull()
  })
})

describe('getQueuePageWindow', () => {
  it('keeps a full page and reports a following page when take returned extra', () => {
    expect(getQueuePageWindow(['a', 'b', 'c'], 2)).toEqual({
      pageRecordList: ['a', 'b'],
      hasNextPage: true,
    })
  })

  it('returns the whole list when it fits on one page', () => {
    expect(getQueuePageWindow(['a', 'b'], 2)).toEqual({
      pageRecordList: ['a', 'b'],
      hasNextPage: false,
    })
  })
})
