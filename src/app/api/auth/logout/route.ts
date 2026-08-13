import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from '@/lib/session'

export const POST = async () => {
  const response = NextResponse.json({ ok: true })

  // Same attributes as when it was set, with a zero lifetime: a cookie is only
  // replaced when path and the other attributes match.
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(),
    maxAge: 0,
  })

  return response
}
