import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { SESSION_COOKIE_NAME } from '../src/lib/session'

/*
 * Proves R2 over HTTP, not over the authorization unit tests.
 *
 * Those tests already pin the matrix. This script is what a reviewer can run
 * the way an attacker would: paste an item ID into curl, with a stolen
 * session or none at all, and see that the Route Handlers still refuse.
 *
 * It inserts its own Support items and deletes them afterwards.
 *
 * Usage:
 *   npm run dev          # another terminal
 *   npm run verify:r2
 *
 * Against a deploy:
 *   VERIFY_BASE_URL=https://example.vercel.app npm run verify:r2
 */

const SUPPORT_WORKSPACE_ID = 'ws_support'
const BOB_USER_ID = 'user_bob'
const CAROL_USER_ID = 'user_carol'
const DAVE_USER_ID = 'user_dave'
const ERIN_USER_ID = 'user_erin'
const ALICE_USER_ID = 'user_alice'
const UNKNOWN_ITEM_ID = 'item_r2_does_not_exist'
const DEFAULT_BASE_URL = 'http://localhost:3000'

type ItemAction = 'claim' | 'resolve' | 'release'

interface FailureBody {
  code: string
  message: string
}

interface ActionResponse {
  statusCode: number
  body: unknown
}

interface Expectation {
  label: string
  cookieHeader: string | null
  itemId: string
  action: ItemAction
  statusCode: number
  code: string
}

const getBaseUrl = (): string =>
  (process.env.VERIFY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')

const createPrismaClient = () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Set DIRECT_URL (or DATABASE_URL) before verifying R2.')
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

function fail(message: string): never {
  console.error(`R2 failed: ${message}`)
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

const fetchItemAction = async (
  baseUrl: string,
  itemId: string,
  action: ItemAction,
  cookieHeader: string | null
): Promise<ActionResponse> => {
  const headerList: Record<string, string> = {}

  if (cookieHeader) {
    headerList.Cookie = cookieHeader
  }

  const response = await fetch(`${baseUrl}/api/items/${itemId}/${action}`, {
    method: 'POST',
    headers: headerList,
  })

  const body: unknown = await response.json().catch(() => null)

  return { statusCode: response.status, body }
}

const isFailureBody = (body: unknown): body is FailureBody =>
  typeof body === 'object' &&
  body !== null &&
  'code' in body &&
  'message' in body &&
  typeof body.code === 'string' &&
  typeof body.message === 'string'

const expectFailure = (
  expectation: Expectation,
  actionResponse: ActionResponse
): FailureBody => {
  if (actionResponse.statusCode !== expectation.statusCode) {
    fail(
      `${expectation.label}: expected HTTP ${expectation.statusCode}, got ${actionResponse.statusCode}.`
    )
  }

  if (!isFailureBody(actionResponse.body)) {
    fail(`${expectation.label}: response was not { code, message }.`)
  }

  if (actionResponse.body.code !== expectation.code) {
    fail(
      `${expectation.label}: expected ${expectation.code}, got ${actionResponse.body.code}.`
    )
  }

  console.log(
    `${expectation.label}: HTTP ${actionResponse.statusCode} ${actionResponse.body.code}`
  )

  return actionResponse.body
}

const fetchQueueHtml = async (
  baseUrl: string,
  cookieHeader: string
): Promise<string> => {
  const response = await fetch(`${baseUrl}/queue`, {
    headers: { Cookie: cookieHeader },
    redirect: 'follow',
  })

  if (!response.ok) {
    fail(`GET /queue returned ${response.status}.`)
  }

  return response.text()
}

const verify = async () => {
  const baseUrl = getBaseUrl()
  const prisma = createPrismaClient()
  const nonce = randomUUID()
  const pendingTitle = `R2 verify pending ${nonce}`
  const claimedTitle = `R2 verify claimed ${nonce}`

  console.log(`Target: ${baseUrl}`)

  try {
    await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' })
  } catch {
    fail(
      `Could not reach ${baseUrl}. Start the app with npm run dev, or set VERIFY_BASE_URL.`
    )
  }

  const [pendingItemRecord, claimedItemRecord] = await Promise.all([
    prisma.item.create({
      data: {
        workspaceId: SUPPORT_WORKSPACE_ID,
        title: pendingTitle,
        status: 'PENDING',
      },
      select: { id: true },
    }),
    prisma.item.create({
      data: {
        workspaceId: SUPPORT_WORKSPACE_ID,
        title: claimedTitle,
        status: 'CLAIMED',
        claimedById: BOB_USER_ID,
        claimedAt: new Date(),
      },
      select: { id: true },
    }),
  ])

  const pendingItemId = pendingItemRecord.id
  const claimedItemId = claimedItemRecord.id
  const createdItemIdList = [pendingItemId, claimedItemId]

  console.log(`Pending item: ${pendingItemId}`)
  console.log(`Claimed item: ${claimedItemId}`)

  try {
    const [aliceCookie, carolCookie, daveCookie, erinCookie] =
      await Promise.all([
        fetchLoginCookie(baseUrl, ALICE_USER_ID),
        fetchLoginCookie(baseUrl, CAROL_USER_ID),
        fetchLoginCookie(baseUrl, DAVE_USER_ID),
        fetchLoginCookie(baseUrl, ERIN_USER_ID),
      ])

    const expectationList: Expectation[] = [
      {
        label: 'Unauthenticated claim',
        cookieHeader: null,
        itemId: pendingItemId,
        action: 'claim',
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      },
      {
        label: 'Unauthenticated resolve',
        cookieHeader: null,
        itemId: claimedItemId,
        action: 'resolve',
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      },
      {
        label: 'Unauthenticated release',
        cookieHeader: null,
        itemId: claimedItemId,
        action: 'release',
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      },
      {
        label: 'Viewer claim',
        cookieHeader: daveCookie,
        itemId: pendingItemId,
        action: 'claim',
        statusCode: 403,
        code: 'FORBIDDEN',
      },
      {
        label: 'Viewer resolve',
        cookieHeader: daveCookie,
        itemId: claimedItemId,
        action: 'resolve',
        statusCode: 403,
        code: 'FORBIDDEN',
      },
      {
        label: 'Viewer release',
        cookieHeader: daveCookie,
        itemId: claimedItemId,
        action: 'release',
        statusCode: 403,
        code: 'FORBIDDEN',
      },
      {
        label: 'Billing owner claim on Support item',
        cookieHeader: erinCookie,
        itemId: pendingItemId,
        action: 'claim',
        statusCode: 404,
        code: 'NOT_FOUND',
      },
      {
        label: 'Billing owner resolve on Support item',
        cookieHeader: erinCookie,
        itemId: claimedItemId,
        action: 'resolve',
        statusCode: 404,
        code: 'NOT_FOUND',
      },
      {
        label: 'Billing owner release on Support item',
        cookieHeader: erinCookie,
        itemId: claimedItemId,
        action: 'release',
        statusCode: 404,
        code: 'NOT_FOUND',
      },
      {
        label: 'Unknown item as Billing owner',
        cookieHeader: erinCookie,
        itemId: UNKNOWN_ITEM_ID,
        action: 'claim',
        statusCode: 404,
        code: 'NOT_FOUND',
      },
      {
        label: 'Member resolve of someone else\'s claim',
        cookieHeader: carolCookie,
        itemId: claimedItemId,
        action: 'resolve',
        statusCode: 403,
        code: 'NOT_CLAIMER',
      },
      {
        label: 'Member release of someone else\'s claim',
        cookieHeader: carolCookie,
        itemId: claimedItemId,
        action: 'release',
        statusCode: 403,
        code: 'NOT_CLAIMER',
      },
      {
        label: 'Owner resolve of someone else\'s claim',
        cookieHeader: aliceCookie,
        itemId: claimedItemId,
        action: 'resolve',
        statusCode: 403,
        code: 'NOT_CLAIMER',
      },
    ]

    const failureBodyByLabel = new Map<string, FailureBody>()

    for (const expectation of expectationList) {
      const actionResponse = await fetchItemAction(
        baseUrl,
        expectation.itemId,
        expectation.action,
        expectation.cookieHeader
      )

      failureBodyByLabel.set(
        expectation.label,
        expectFailure(expectation, actionResponse)
      )
    }

    const crossWorkspaceBody = failureBodyByLabel.get(
      'Billing owner claim on Support item'
    )
    const unknownItemBody = failureBodyByLabel.get(
      'Unknown item as Billing owner'
    )

    if (!crossWorkspaceBody || !unknownItemBody) {
      fail('Missing 404 bodies for the existence-leak check.')
    }

    if (
      crossWorkspaceBody.code !== unknownItemBody.code ||
      crossWorkspaceBody.message !== unknownItemBody.message
    ) {
      fail(
        'Cross-workspace 404 body differed from unknown-item 404; existence leaked.'
      )
    }

    console.log('Cross-workspace 404 matches unknown-item 404.')

    const [pendingItem, claimedItem] = await Promise.all([
      prisma.item.findUnique({
        where: { id: pendingItemId },
        select: { status: true, claimedById: true },
      }),
      prisma.item.findUnique({
        where: { id: claimedItemId },
        select: { status: true, claimedById: true },
      }),
    ])

    if (pendingItem?.status !== 'PENDING' || pendingItem.claimedById !== null) {
      fail(
        `Pending item was mutated: ${pendingItem?.status} / ${pendingItem?.claimedById}.`
      )
    }

    if (
      claimedItem?.status !== 'CLAIMED' ||
      claimedItem.claimedById !== BOB_USER_ID
    ) {
      fail(
        `Claimed item was mutated: ${claimedItem?.status} / ${claimedItem?.claimedById}.`
      )
    }

    console.log('Database: attacked rows unchanged.')

    const unauthenticatedQueueResponse = await fetch(`${baseUrl}/queue`, {
      redirect: 'manual',
    })

    if (unauthenticatedQueueResponse.status !== 307) {
      fail(
        `Unauthenticated GET /queue expected 307, got ${unauthenticatedQueueResponse.status}.`
      )
    }

    console.log('Unauthenticated GET /queue: HTTP 307')

    const [daveQueueHtml, erinQueueHtml] = await Promise.all([
      fetchQueueHtml(baseUrl, daveCookie),
      fetchQueueHtml(baseUrl, erinCookie),
    ])

    if (!daveQueueHtml.includes(pendingTitle)) {
      fail('Viewer queue did not include the Support pending item.')
    }

    if (erinQueueHtml.includes(pendingTitle) || erinQueueHtml.includes(claimedTitle)) {
      fail('Billing queue included a Support item title.')
    }

    console.log('Viewer can read Support rows; Billing cannot.')
    console.log('R2 passed.')
    console.log('Curl recipes that use a live item id are in the README.')
  } finally {
    await prisma.item
      .deleteMany({ where: { id: { in: createdItemIdList } } })
      .catch(() => undefined)
    await prisma.$disconnect()
  }
}

verify().catch((verifyError: unknown) => {
  console.error(verifyError)
  process.exit(1)
})
