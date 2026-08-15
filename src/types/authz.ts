import type { Role } from '@/generated/prisma/enums'
import type { AuthenticatedUser } from '@/types/user'

/*
 * Authorization types used by the decision function, the requireItemAction
 * wrapper, and later by Route Handlers. Kept here rather than next to any one
 * of those files so the HTTP layer and the tests share one shape.
 */

export type ItemAction = 'read' | 'claim' | 'resolve' | 'release'

export interface ItemAuthRecord {
  id: string
  workspaceId: string
  claimedById: string | null
}

export interface MembershipAuthRecord {
  userId: string
  workspaceId: string
  role: Role
}

export type AuthorizationFailureCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'NOT_CLAIMER'

export type AuthorizationFailure = {
  isAuthorized: false
  statusCode: 401 | 403 | 404
  code: AuthorizationFailureCode
  message: string
}

export type AuthorizationSuccess = {
  isAuthorized: true
  user: AuthenticatedUser
  item: ItemAuthRecord
  role: Role
  workspaceId: string
}

export type AuthorizationResult = AuthorizationSuccess | AuthorizationFailure

export interface AuthorizationDecisionInput {
  user: AuthenticatedUser | null
  item: ItemAuthRecord | null
  membership: MembershipAuthRecord | null
  action: ItemAction
}

export interface CallerMembershipRecord {
  userId: string
  workspaceId: string
  workspaceName: string
  role: Role
}

export type CallerMembershipSuccess = {
  isAuthorized: true
  user: AuthenticatedUser
  membership: CallerMembershipRecord
}

export type CallerMembershipResult =
  | CallerMembershipSuccess
  | AuthorizationFailure
