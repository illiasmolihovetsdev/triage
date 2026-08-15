import type { Role } from '@/generated/prisma/enums'
import type {
  AuthorizationDecisionInput,
  AuthorizationResult,
  ItemAction,
} from '@/types/authz'

/*
 * The role matrix and the 401/403/404 decision live here, not in a Route
 * Handler, so every mutation and every test uses the same rules.
 *
 * This file imports neither Next.js nor Prisma Client. That is what makes the
 * matrix testable without a request or a database: the interesting question is
 * "given these three facts, what happens", not "can we load the facts".
 */

const ACTIONS_ALLOWED_BY_ROLE: Record<Role, readonly ItemAction[]> = {
  OWNER: ['read', 'claim', 'resolve', 'release'],
  MEMBER: ['read', 'claim', 'resolve', 'release'],
  VIEWER: ['read'],
}

const ACTIONS_THAT_REQUIRE_CLAIMER: readonly ItemAction[] = [
  'resolve',
  'release',
]

export const canRolePerformAction = (
  role: Role,
  action: ItemAction
): boolean => ACTIONS_ALLOWED_BY_ROLE[role].includes(action)

export const doesActionRequireClaimer = (action: ItemAction): boolean =>
  ACTIONS_THAT_REQUIRE_CLAIMER.includes(action)

const createUnauthenticatedResult = (): AuthorizationResult => ({
  isAuthorized: false,
  statusCode: 401,
  code: 'UNAUTHENTICATED',
  message: 'Not authenticated.',
})

const createNotFoundResult = (): AuthorizationResult => ({
  isAuthorized: false,
  statusCode: 404,
  code: 'NOT_FOUND',
  message: 'Item not found.',
})

const createForbiddenResult = (): AuthorizationResult => ({
  isAuthorized: false,
  statusCode: 403,
  code: 'FORBIDDEN',
  message: 'You do not have permission to perform this action.',
})

const createNotClaimerResult = (): AuthorizationResult => ({
  isAuthorized: false,
  statusCode: 403,
  code: 'NOT_CLAIMER',
  message: 'Only the current claimer can perform this action.',
})

/*
 * Order is the security model:
 *
 * 1. No user → 401. Identity comes from the cookie, never from the body.
 * 2. No item, or no membership in the item's workspace → 404. Cross-workspace
 *    access must not reveal that the item exists, so it shares the unknown-item
 *    response.
 * 3. Role cannot perform the action → 403. The caller is in the workspace, so
 *    hiding the item would be lying; refusing the action is enough.
 * 4. Resolve and release also require the caller to be the current claimer.
 *    Owners do not override this: they have the same item permissions as
 *    members.
 */
export const getAuthorizationDecision = ({
  user,
  item,
  membership,
  action,
}: AuthorizationDecisionInput): AuthorizationResult => {
  if (!user) {
    return createUnauthenticatedResult()
  }

  if (!item) {
    return createNotFoundResult()
  }

  const hasMembershipInItemWorkspace =
    membership !== null &&
    membership.userId === user.id &&
    membership.workspaceId === item.workspaceId

  if (!hasMembershipInItemWorkspace) {
    return createNotFoundResult()
  }

  if (!canRolePerformAction(membership.role, action)) {
    return createForbiddenResult()
  }

  if (
    doesActionRequireClaimer(action) &&
    item.claimedById !== user.id
  ) {
    return createNotClaimerResult()
  }

  return {
    isAuthorized: true,
    user,
    item,
    role: membership.role,
    workspaceId: item.workspaceId,
  }
}
