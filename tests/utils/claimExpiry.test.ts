import { describe, expect, it } from 'vitest'
import {
  getClaimExpiryThreshold,
  isClaimExpired,
} from '@/utils/claimExpiry'

describe('claim expiry', () => {
  it('treats a claim older than the TTL as expired', () => {
    const now = new Date('2026-08-16T12:00:20.000Z')
    const threshold = getClaimExpiryThreshold(now)
    const expiredClaimedAt = new Date(threshold.getTime() - 1)
    const freshClaimedAt = threshold

    expect(isClaimExpired(expiredClaimedAt, now)).toBe(true)
    expect(isClaimExpired(freshClaimedAt, now)).toBe(false)
    expect(isClaimExpired(null, now)).toBe(false)
  })
})
