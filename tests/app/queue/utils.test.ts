import { describe, expect, it } from 'vitest'
import {
  getCurrentQueuePage,
  getPageNumber,
  getQueryStringValue,
  getQueueStatusFilter,
} from '@/app/queue/utils'

describe('getQueryStringValue', () => {
  it('keeps a non-empty string and ignores missing or empty values', () => {
    expect(getQueryStringValue('abc')).toBe('abc')
    expect(getQueryStringValue('')).toBeUndefined()
    expect(getQueryStringValue(undefined)).toBeUndefined()
    expect(getQueryStringValue(['abc', 'def'])).toBeUndefined()
  })
})

describe('getPageNumber', () => {
  it('parses a positive integer and rejects the rest', () => {
    expect(getPageNumber('3')).toBe(3)
    expect(getPageNumber('0')).toBeUndefined()
    expect(getPageNumber('-1')).toBeUndefined()
    expect(getPageNumber('first')).toBeUndefined()
    expect(getPageNumber(['2'])).toBeUndefined()
  })
})

describe('getCurrentQueuePage', () => {
  it('is page 1 when there is no cursor', () => {
    expect(getCurrentQueuePage(undefined, undefined, '9')).toBe(1)
  })

  it('uses the page query when a cursor is present', () => {
    expect(getCurrentQueuePage('cursor-token', undefined, '4')).toBe(4)
  })

  it('does not treat a cursor as page 1', () => {
    expect(getCurrentQueuePage('cursor-token', undefined, '1')).toBe(2)
    expect(getCurrentQueuePage('cursor-token', undefined, undefined)).toBe(2)
  })
})

describe('getQueueStatusFilter', () => {
  it('keeps a known status and treats anything else as all', () => {
    expect(getQueueStatusFilter('pending')).toBe('pending')
    expect(getQueueStatusFilter('claimed')).toBe('claimed')
    expect(getQueueStatusFilter('resolved')).toBe('resolved')
    expect(getQueueStatusFilter('all')).toBe('all')
    expect(getQueueStatusFilter('nope')).toBe('all')
    expect(getQueueStatusFilter(undefined)).toBe('all')
  })
})
