import { describe, expect, it } from 'vitest'
import { mapQueueItem } from '@/services/items/utils'

describe('mapQueueItem', () => {
  it('maps a claimed item without a notification', () => {
    expect(
      mapQueueItem({
        id: 'item_1',
        title: 'Support #1 — Password reset request',
        status: 'CLAIMED',
        claimedBy: { name: 'Bob Marsh' },
        notificationAttempt: null,
      })
    ).toEqual({
      id: 'item_1',
      title: 'Support #1 — Password reset request',
      status: 'claimed',
      claimerName: 'Bob Marsh',
      notificationStatus: null,
    })
  })

  it('maps a resolved item with a notification outcome', () => {
    expect(
      mapQueueItem({
        id: 'item_2',
        title: 'Billing #4 — Duplicate charge reported',
        status: 'RESOLVED',
        claimedBy: { name: 'Erin Walsh' },
        notificationAttempt: { status: 'FAILED' },
      })
    ).toEqual({
      id: 'item_2',
      title: 'Billing #4 — Duplicate charge reported',
      status: 'resolved',
      claimerName: 'Erin Walsh',
      notificationStatus: 'failed',
    })
  })

  it('maps a pending item with empty claimer and notification', () => {
    expect(
      mapQueueItem({
        id: 'item_3',
        title: 'Support #9 — Export job stuck',
        status: 'PENDING',
        claimedBy: null,
        notificationAttempt: null,
      })
    ).toEqual({
      id: 'item_3',
      title: 'Support #9 — Export job stuck',
      status: 'pending',
      claimerName: null,
      notificationStatus: null,
    })
  })
})
