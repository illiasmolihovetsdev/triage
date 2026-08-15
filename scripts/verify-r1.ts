import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { SESSION_COOKIE_NAME } from '../src/lib/session'

/*
 * Proves R1 over HTTP, not over an in-process Prisma client.
 *
 * The unit tests already show that one UPDATE wins. This script is what the
 * assignment asks a reviewer to run: two claim requests in flight against a
 * live server, then a look at the row those requests actually changed.
 *
 * It inserts its own PENDING item and deletes it afterwards, so it does not
 * depend on whichever seed row happens to be first.
 *
 * Usage:
 *   npm run dev          # another terminal
 *   npm run verify:r1
 *
 * Against a deploy, point both the app and this script at the same database:
 *   VERIFY_BASE_URL=https://example.vercel.app npm run verify:r1
 */

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BOB_USER_ID = 'user_bob'
const CAROL_USER_ID = 'user_carol'
const DEFAULT_BASE_URL = 'http://localhost:3000'

interface ClaimSuccessBody {
  id: string
  status: string
  claimerId: string | null
  claimerName: string | null
}

interface ClaimConflictBody {
  code: string
  message: string
  claimedBy: { id: string; name: string } | null
}

interface ClaimResponse {
  statusCode: number
  body: unknown
}

const getBaseUrl = (): string =>
  (process.env.VERIFY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')

const createPrismaClient = () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Set DIRECT_URL (or DATABASE_URL) before verifying R1.')
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

function fail(message: string): never {
  console.error(`R1 failed: ${message}`)
  process.exit(1)
}

const getSessionCookieHeader = (response: Response): string => {
  const sessionCookie = response.headers
    .getSetCookie()
    .find((cookieHeader) => cookieHeader.startsWith(`${SESSION_COOKIE_NAME}=`))

  if (!sessionCookie) {
    fail('Login did not set a session cookie.')
  }

  return sessionCookie.split(';', 1)[0]
}

const fetchLoginCookie = async (
  baseUrl: string,
  userId: string
): Promise<string> => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })

  if (!response.ok) {
    fail(`Login as ${userId} returned ${response.status}.`)
  }

  return getSessionCookieHeader(response)
}

const fetchClaim = async (
  baseUrl: string,
  itemId: string,
  sessionCookieHeader: string
): Promise<ClaimResponse> => {
  const response = await fetch(`${baseUrl}/api/items/${itemId}/claim`, {
    method: 'POST',
    headers: { Cookie: sessionCookieHeader },
  })

  const body: unknown = await response.json().catch(() => null)

  return { statusCode: response.status, body }
}

const isClaimSuccessBody = (body: unknown): body is ClaimSuccessBody =>
  typeof body === 'object' &&
  body !== null &&
  'id' in body &&
  'status' in body &&
  'claimerId' in body &&
  typeof body.id === 'string' &&
  typeof body.status === 'string' &&
  (body.claimerId === null || typeof body.claimerId === 'string')

const isClaimConflictBody = (body: unknown): body is ClaimConflictBody =>
  typeof body === 'object' &&
  body !== null &&
  'code' in body &&
  body.code === 'CLAIM_CONFLICT' &&
  'claimedBy' in body

const verify = async () => {
  const baseUrl = getBaseUrl()
  const prisma = createPrismaClient()

  console.log(`Target: ${baseUrl}`)

  try {
    await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' })
  } catch {
    fail(
      `Could not reach ${baseUrl}. Start the app with npm run dev, or set VERIFY_BASE_URL.`
    )
  }

  const itemRecord = await prisma.item.create({
    data: {
      workspaceId: SUPPORT_WORKSPACE_ID,
      title: 'R1 verify — concurrent HTTP claim',
      status: 'PENDING',
    },
    select: { id: true },
  })

  const itemId = itemRecord.id
  console.log(`Item: ${itemId}`)

  try {
    const [bobCookieHeader, carolCookieHeader] = await Promise.all([
      fetchLoginCookie(baseUrl, BOB_USER_ID),
      fetchLoginCookie(baseUrl, CAROL_USER_ID),
    ])

    const [bobClaimResponse, carolClaimResponse] = await Promise.all([
      fetchClaim(baseUrl, itemId, bobCookieHeader),
      fetchClaim(baseUrl, itemId, carolCookieHeader),
    ])

    const claimResponseList = [
      { caller: 'Bob', ...bobClaimResponse },
      { caller: 'Carol', ...carolClaimResponse },
    ]

    claimResponseList.forEach((claimResponse) => {
      console.log(`${claimResponse.caller}: HTTP ${claimResponse.statusCode}`)
    })

    const successList = claimResponseList.filter(
      (claimResponse) => claimResponse.statusCode === 200
    )
    const conflictList = claimResponseList.filter(
      (claimResponse) => claimResponse.statusCode === 409
    )

    if (successList.length !== 1 || conflictList.length !== 1) {
      fail(
        `Expected one 200 and one 409, got ${successList.length} successes and ${conflictList.length} conflicts.`
      )
    }

    const winnerClaimResponse = successList[0]
    const loserClaimResponse = conflictList[0]

    if (!winnerClaimResponse || !loserClaimResponse) {
      fail('Expected one 200 and one 409.')
    }

    const winnerBody = winnerClaimResponse.body
    const loserBody = loserClaimResponse.body

    if (!isClaimSuccessBody(winnerBody)) {
      fail('Winning response was not a claimed item.')
    }

    if (winnerBody.status !== 'claimed' || !winnerBody.claimerId) {
      fail('Winning response did not name a claimer.')
    }

    if (!isClaimConflictBody(loserBody)) {
      fail('Losing response was not CLAIM_CONFLICT.')
    }

    if (loserBody.claimedBy?.id !== winnerBody.claimerId) {
      fail(
        `Loser was told holder ${loserBody.claimedBy?.id}, winner is ${winnerBody.claimerId}.`
      )
    }

    const storedItem = await prisma.item.findUnique({
      where: { id: itemId },
      select: { status: true, claimedById: true },
    })

    if (
      storedItem?.status !== 'CLAIMED' ||
      storedItem.claimedById !== winnerBody.claimerId
    ) {
      fail(
        `Database row is ${storedItem?.status} / ${storedItem?.claimedById}, expected CLAIMED / ${winnerBody.claimerId}.`
      )
    }

    console.log(
      `Winner: ${winnerClaimResponse.caller} (${winnerBody.claimerName})`
    )
    console.log(`Loser told: ${loserBody.message}`)
    console.log('Database: one CLAIMED row, same holder.')
    console.log('R1 passed.')
  } finally {
    await prisma.item.delete({ where: { id: itemId } }).catch(() => undefined)
    await prisma.$disconnect()
  }
}

verify().catch((verifyError: unknown) => {
  console.error(verifyError)
  process.exit(1)
})
