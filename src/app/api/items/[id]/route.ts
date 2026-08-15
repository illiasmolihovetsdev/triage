import { NextResponse } from 'next/server'
import { requireItemAction } from '@/lib/authz'
import { fetchQueueItemById } from '@/services/items'

/*
 * A single item for the open queue row. Authorization is the same as every
 * other item route: cookie, then the item's workspace, then membership. The
 * client polls this after resolve so SENT/FAILED can replace PENDING without
 * a full page refresh. Cache-Control is no-store so a poll cannot reuse a
 * PENDING response.
 */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: itemId } = await context.params
  const authorizationResult = await requireItemAction(itemId, 'read')

  if (!authorizationResult.isAuthorized) {
    return NextResponse.json(
      {
        code: authorizationResult.code,
        message: authorizationResult.message,
      },
      { status: authorizationResult.statusCode }
    )
  }

  const itemResult = await fetchQueueItemById(itemId)

  if (!itemResult.isSuccess) {
    return NextResponse.json(
      {
        code: 'NOT_FOUND',
        message: itemResult.errorMessage,
      },
      { status: 404 }
    )
  }

  return NextResponse.json(itemResult.item, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
