import 'server-only'

import { getCurrentUser } from '@/lib/auth'
import { fetchItemAuthRecord } from '@/services/items'
import {
  fetchCallerMembershipList,
  fetchMembershipAuthRecord,
} from '@/services/memberships'
import {
  getAuthorizationDecision,
  getCallerMembershipDecision,
} from '@/utils/authorization'
import type {
  AuthorizationResult,
  CallerMembershipResult,
  ItemAction,
} from '@/types/authz'

/*
 * The single entry point for "may this caller do this to this item?".
 *
 * Route Handlers will call this before any mutation. The UI may hide buttons
 * using the same role matrix, but that is display only: a curl request with a
 * known item ID still has to pass through here.
 *
 * Workspace is derived from the item row. A workspace ID in the request body,
 * if a client ever sends one, is never read.
 */
export const requireItemAction = async (
  itemId: string,
  action: ItemAction
): Promise<AuthorizationResult> => {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return getAuthorizationDecision({
      user: null,
      item: null,
      membership: null,
      action,
    })
  }

  const itemAuthRecord = await fetchItemAuthRecord(itemId)

  if (!itemAuthRecord) {
    return getAuthorizationDecision({
      user: currentUser,
      item: null,
      membership: null,
      action,
    })
  }

  const membershipAuthRecord = await fetchMembershipAuthRecord(
    currentUser.id,
    itemAuthRecord.workspaceId
  )

  return getAuthorizationDecision({
    user: currentUser,
    item: itemAuthRecord,
    membership: membershipAuthRecord,
    action,
  })
}

export const requireCallerMembership = async (): Promise<CallerMembershipResult> => {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return getCallerMembershipDecision(null, [])
  }

  const membershipList = await fetchCallerMembershipList(currentUser.id)

  return getCallerMembershipDecision(currentUser, membershipList)
}
