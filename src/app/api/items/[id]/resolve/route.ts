import { NextResponse } from 'next/server'
import { requireItemAction } from '@/lib/authz'
import { resolveItem } from '@/services/items'

/*
 * Resolve is authorized first, then a conditional UPDATE that also requires
 * this caller to still hold the CLAIMED row. Viewers and non-claimers never
 * reach that write. Notification is a later step; this route only changes
 * status.
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

  return NextResponse.json(resolveResult.item)
}
