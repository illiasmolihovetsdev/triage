/*
 * Assignment TTL is 30 minutes (`ASSIGNMENT_CLAIM_TTL_MS`). CLAIM_TTL_MS is
 * short while we verify the predicate against the running app; switch it to
 * ASSIGNMENT_CLAIM_TTL_MS after that check.
 */
export const ASSIGNMENT_CLAIM_TTL_MS = 30 * 60 * 1000
export const CLAIM_TTL_MS = 2 * 1000

export const getClaimExpiryThreshold = (now = new Date()): Date =>
  new Date(now.getTime() - CLAIM_TTL_MS)

export const isClaimExpired = (
  claimedAt: Date | null,
  now = new Date()
): boolean =>
  claimedAt !== null &&
  claimedAt.getTime() < getClaimExpiryThreshold(now).getTime()
