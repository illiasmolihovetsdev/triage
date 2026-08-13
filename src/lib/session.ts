import { SignJWT, jwtVerify } from 'jose'

/*
 * Session token handling, kept free of Next.js and database imports so it can
 * be tested directly.
 *
 * The assignment does not ask for real OAuth: the user picks a seeded identity.
 * What still has to hold is that the identity cannot be edited afterwards. The
 * cookie therefore carries a signed JWT rather than a plain user ID. Without
 * AUTH_SECRET an attacker can change the name on the cookie but not produce a
 * valid signature for it.
 */

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export const SESSION_COOKIE_NAME = 'triage_session'

const getSigningKey = () => {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    // Failing loudly is deliberate. A fallback secret would make every
    // deployment that forgot the variable silently forgeable.
    throw new Error('AUTH_SECRET is not set')
  }

  return new TextEncoder().encode(secret)
}

export const createSessionToken = async (userId: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSigningKey())

/*
 * Returns the user ID the token was issued for, or null if the token is
 * missing, malformed, expired, or signed with a different key. Callers treat
 * null as "not authenticated" rather than distinguishing the reasons, since
 * the distinction is of no use to the client.
 */
export const readSessionToken = async (
  token: string | undefined
): Promise<string | null> => {
  if (!token) {
    return null
  }

  try {
    const verified = await jwtVerify(token, getSigningKey(), {
      algorithms: ['HS256'],
    })

    return verified.payload.sub ?? null
  } catch {
    return null
  }
}

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
})
