import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  readSessionToken,
} from '@/lib/session'
import {
  ALREADY_SIGNED_IN_CODE,
  ALREADY_SIGNED_IN_MESSAGE,
  isAlreadySignedInAsRequestedUser,
} from '@/utils/login'

interface LoginRequestBody {
  userId?: unknown
}

/*
 * Signing in as a seeded user. This stands in for OAuth, which the assignment
 * explicitly does not want.
 *
 * The submitted ID must match a real user, otherwise anyone could mint a
 * session for an arbitrary string. Only identity is taken from the request:
 * roles and workspace membership are always read from the database at the
 * point where they are enforced, never carried in the cookie, so a session
 * cannot outlive or contradict the current membership rows.
 *
 * Repeating the current session user is refused. The picker already disables
 * that row; this check is the real boundary if the client is bypassed.
 */
export const POST = async (request: Request) => {
  let body: LoginRequestBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: 'Expected a JSON body.' },
      { status: 400 }
    )
  }

  const { userId } = body

  if (typeof userId !== 'string' || userId.length === 0) {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: 'userId is required.' },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  const sessionUserId = await readSessionToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  )

  if (isAlreadySignedInAsRequestedUser(sessionUserId, userId)) {
    return NextResponse.json(
      { code: ALREADY_SIGNED_IN_CODE, message: ALREADY_SIGNED_IN_MESSAGE },
      { status: 409 }
    )
  }

  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  })

  if (!userRecord) {
    return NextResponse.json(
      { code: 'UNKNOWN_USER', message: 'No such user.' },
      { status: 400 }
    )
  }

  const response = NextResponse.json({ id: userRecord.id, name: userRecord.name })

  response.cookies.set(
    SESSION_COOKIE_NAME,
    await createSessionToken(userRecord.id),
    getSessionCookieOptions()
  )

  return response
}
