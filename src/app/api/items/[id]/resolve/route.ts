import { after, NextResponse } from 'next/server'
import { requireItemAction } from '@/lib/authz'
import { resolveItem } from '@/services/items'
import { dispatchNotificationAttempt } from '@/services/notifications/dispatch'

/*
 * Resolve is authorized first, then a conditional UPDATE that also requires
 * this caller to still hold the CLAIMED row. The 200 is returned before
 * notify() runs: after() keeps the invocation alive long enough to attempt
 * delivery once and write SENT or FAILED. A failure cannot undo the resolve.
 */
export const POST = async (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: itemId } = await context.params
  const authorizationResult = await requireItemAction(itemId, 'resolve')

  if (!authorizationResult.isAuthorized) {
    return NextResponse.json(
      {
        code: authorizationResult.code,
        message: authorizationResult.message,
      },
      { status: authorizationResult.statusCode }
    )
  }

  const resolveResult = await resolveItem(itemId, authorizationResult.user.id)

  if (!resolveResult.isSuccess) {
    if (resolveResult.code === 'RESOLVE_CONFLICT') {
      return NextResponse.json(
        {
          code: resolveResult.code,
          message: resolveResult.message,
          item: resolveResult.item,
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        code: resolveResult.code,
        message: resolveResult.message,
      },
      { status: resolveResult.statusCode }
    )
  }

  after(async () => {
    await dispatchNotificationAttempt(itemId)
  })

  return NextResponse.json(resolveResult.item)
}
