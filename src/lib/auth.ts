import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/session'
import type { AuthenticatedUser } from '@/types/user'

/*
 * Resolves the caller from the signed session cookie.
 *
 * The user ID is never taken from a request body, a query parameter, or a
 * header the client controls. It comes from the cookie signature, and the row
 * is then loaded from the database, so a session naming a deleted user is
 * treated as unauthenticated rather than trusted on the strength of the token.
 */
export const getCurrentUser = async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies()
  const userId = await readSessionToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  )

  if (!userId) {
    return null
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  })

  return userRecord
}
