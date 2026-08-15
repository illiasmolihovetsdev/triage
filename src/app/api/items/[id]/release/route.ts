import { NextResponse } from 'next/server'
import { requireItemAction } from '@/lib/authz'
import { releaseItem } from '@/services/items'

/*
 * Release is authorized first, then a conditional UPDATE that also requires
 * this caller to still hold the CLAIMED row. Viewers and non-claimers never
 * reach that write. A successful release returns the item to PENDING.
 */
export const POST = async (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: itemId } = await context.params
  const authorizationResult = await requireItemAction(itemId, 'release')

  if (!authorizationResult.isAuthorized) {
    return NextResponse.json(
      {
        code: authorizationResult.code,
        message: authorizationResult.message,
      },
      { status: authorizationResult.statusCode }
    )
  }

  const releaseResult = await releaseItem(itemId, authorizationResult.user.id)

  if (!releaseResult.isSuccess) {
    if (releaseResult.code === 'RELEASE_CONFLICT') {
      return NextResponse.json(
        {
          code: releaseResult.code,
          message: releaseResult.message,
          item: releaseResult.item,
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        code: releaseResult.code,
        message: releaseResult.message,
      },
      { status: releaseResult.statusCode }
    )
  }

  return NextResponse.json(releaseResult.item)
}
