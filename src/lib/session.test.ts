import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { SignJWT } from 'jose'
import { createSessionToken, readSessionToken } from '@/lib/session'

/*
 * The session cookie is the only thing standing between "the client says it is
 * Alice" and "the server believes it is Alice". These tests cover the ways a
 * client could try to change that claim.
 */

const TEST_SECRET = 'test-secret-value-for-session-signing-0001'

describe('session token', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.AUTH_SECRET = TEST_SECRET
  })

  it('round-trips the user it was issued for', async () => {
    const token = await createSessionToken('user_alice')

    await expect(readSessionToken(token)).resolves.toBe('user_alice')
  })

  it('rejects a missing token', async () => {
    await expect(readSessionToken(undefined)).resolves.toBeNull()
  })

  it('rejects a token that is not a JWT at all', async () => {
    await expect(readSessionToken('user_alice')).resolves.toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user_alice')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-different-secret-entirely-0000000000'))

    await expect(readSessionToken(forged)).resolves.toBeNull()
  })

  it('rejects a token whose payload was edited', async () => {
    const token = await createSessionToken('user_dave')
    const [header, payload, signature] = token.split('.')
    const editedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        sub: 'user_alice',
      })
    ).toString('base64url')

    await expect(
      readSessionToken(`${header}.${editedPayload}.${signature}`)
    ).resolves.toBeNull()
  })

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user_alice')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(TEST_SECRET))

    await expect(readSessionToken(expired)).resolves.toBeNull()
  })

  it('rejects an unsigned token claiming alg none', async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' })
    ).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user_alice', exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString('base64url')

    await expect(readSessionToken(`${header}.${payload}.`)).resolves.toBeNull()
  })

  it('refuses to verify when AUTH_SECRET is absent', async () => {
    const token = await createSessionToken('user_alice')
    delete process.env.AUTH_SECRET

    await expect(readSessionToken(token)).resolves.toBeNull()
  })
})
