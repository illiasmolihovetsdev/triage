import { describe, expect, it } from 'vitest'
import {
  applyClaimConflict,
  canShowClaimButton,
  canShowReleaseButton,
  canShowResolveButton,
  getClaimButtonLabel,
  getReleaseButtonLabel,
  getResolveButtonLabel,
  getRowFeedbackMessage,
  replaceQueueItem,
} from '@/components/QueueTable/utils'
import type { QueueItem } from '@/types/item'

const pendingItem: QueueItem = {
  id: 'item_1',
  title: 'Support #1 — Password reset request',
  status: 'pending',
  claimerId: null,
  claimerName: null,
  notificationStatus: null,
}

describe('applyClaimConflict', () => {
  it('patches the row to the current holder without a refresh', () => {
    expect(
      applyClaimConflict(pendingItem, { id: 'user_alice', name: 'Alice Nguyen' })
    ).toEqual({
      ...pendingItem,
      status: 'claimed',
      claimerId: 'user_alice',
      claimerName: 'Alice Nguyen',
    })
  })

  it('returns the row to pending when nobody holds it now', () => {
    expect(applyClaimConflict(pendingItem, null)).toEqual({
      ...pendingItem,
      status: 'pending',
      claimerId: null,
      claimerName: null,
    })
  })
})

describe('replaceQueueItem', () => {
  it('replaces only the matching row', () => {
    const otherItem: QueueItem = {
      ...pendingItem,
      id: 'item_2',
      title: 'Support #2 — Duplicate charge reported',
    }
    const claimedItem: QueueItem = {
      ...pendingItem,
      status: 'claimed',
      claimerId: 'user_bob',
      claimerName: 'Bob Marsh',
    }

    expect(replaceQueueItem([pendingItem, otherItem], claimedItem)).toEqual([
      claimedItem,
      otherItem,
    ])
  })
})

describe('claim button visibility', () => {
  it('shows claim only for a pending item when the role allows it', () => {
    expect(canShowClaimButton(true, pendingItem)).toBe(true)
    expect(
      canShowClaimButton(true, { ...pendingItem, status: 'claimed' })
    ).toBe(false)
    expect(canShowClaimButton(false, pendingItem)).toBe(false)
  })

  it('labels the button as claiming while the request is in flight', () => {
    expect(getClaimButtonLabel({ kind: 'idle' })).toBe('Claim')
    expect(getClaimButtonLabel({ kind: 'loading', action: 'claim' })).toBe(
      'Claiming...'
    )
    expect(getClaimButtonLabel({ kind: 'loading', action: 'resolve' })).toBe(
      'Claim'
    )
  })

  it('surfaces conflict and error text, and nothing when idle', () => {
    expect(
      getRowFeedbackMessage({
        kind: 'conflict',
        message: 'Already claimed by Alice Nguyen.',
      })
    ).toBe('Already claimed by Alice Nguyen.')
    expect(
      getRowFeedbackMessage({
        kind: 'error',
        message: 'Network error. Could not claim this item.',
      })
    ).toBe('Network error. Could not claim this item.')
    expect(getRowFeedbackMessage({ kind: 'idle' })).toBeNull()
  })
})

describe('resolve and release button visibility', () => {
  const claimedByBob: QueueItem = {
    ...pendingItem,
    status: 'claimed',
    claimerId: 'user_bob',
    claimerName: 'Bob Marsh',
  }

  it('shows resolve and release only to the claimer when the role allows it', () => {
    expect(canShowResolveButton(true, claimedByBob, 'user_bob')).toBe(true)
    expect(canShowReleaseButton(true, claimedByBob, 'user_bob')).toBe(true)
    expect(canShowResolveButton(true, claimedByBob, 'user_carol')).toBe(false)
    expect(canShowReleaseButton(true, claimedByBob, 'user_carol')).toBe(false)
    expect(canShowResolveButton(false, claimedByBob, 'user_bob')).toBe(false)
    expect(canShowReleaseButton(false, claimedByBob, 'user_bob')).toBe(false)
    expect(canShowResolveButton(true, pendingItem, 'user_bob')).toBe(false)
    expect(canShowReleaseButton(true, pendingItem, 'user_bob')).toBe(false)
  })

  it('labels resolve and release while the matching request is in flight', () => {
    expect(getResolveButtonLabel({ kind: 'idle' })).toBe('Resolve')
    expect(getResolveButtonLabel({ kind: 'loading', action: 'resolve' })).toBe(
      'Resolving...'
    )
    expect(getReleaseButtonLabel({ kind: 'idle' })).toBe('Release')
    expect(getReleaseButtonLabel({ kind: 'loading', action: 'release' })).toBe(
      'Releasing...'
    )
  })
})
