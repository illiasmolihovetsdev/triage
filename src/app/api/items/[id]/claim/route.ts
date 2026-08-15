import { NextResponse } from 'next/server'
import { requireItemAction } from '@/lib/authz'
import { claimItem } from '@/services/items'

/*
 * Claim is authorized first, then a single conditional UPDATE. Viewers never
 * reach the UPDATE. Two members who pass authorization still cannot both
 * claim: PostgreSQL will apply the UPDATE to at most one of them.
 */
export const POST = async (
  _request: Request,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: itemId } = await context.params
  const authorizationResult = await requireItemAction(itemId, 'claim')

  if (!authorizationResult.isAuthorized) {
    return NextResponse.json(
      {
        code: authorizationResult.code,
        message: authorizationResult.message,
      },
      { status: authorizationResult.statusCode }
    )
  }

  const claimResult = await claimItem(itemId, authorizationResult.user.id)

  if (!claimResult.isSuccess) {
    if (claimResult.code === 'CLAIM_CONFLICT') {
      return NextResponse.json(
        {
          code: claimResult.code,
          message: claimResult.message,
          claimedBy: claimResult.claimedBy,
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        code: claimResult.code,
        message: claimResult.message,
      },
      { status: claimResult.statusCode }
    )
  }

  return NextResponse.json(claimResult.item)
}
