import { describe, expect, it } from 'vitest'
import { isAlreadySignedInAsRequestedUser } from '@/utils/login'

describe('isAlreadySignedInAsRequestedUser', () => {
  it('is false when there is no session', () => {
    expect(isAlreadySignedInAsRequestedUser(null, 'user_alice')).toBe(false)
  })

  it('is false when the request is for a different user', () => {
    expect(
      isAlreadySignedInAsRequestedUser('user_alice', 'user_bob')
    ).toBe(false)
  })

  it('is true when the request repeats the current session user', () => {
    expect(
      isAlreadySignedInAsRequestedUser('user_alice', 'user_alice')
    ).toBe(true)
  })
})
