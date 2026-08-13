import type { MembershipWithUserAndWorkspace } from '@/services/users/types'
import type { UserOption, WorkspaceRole } from '@/types/user'

/*
 * Pure mapping from the database record to the UI model. Kept as a standalone
 * function so it can be tested without a database and reused by any query that
 * selects the same shape.
 */
export const mapMembershipToUserOption = (
  membership: MembershipWithUserAndWorkspace
): UserOption => ({
  id: membership.user.id,
  name: membership.user.name,
  email: membership.user.email,
  workspaceName: membership.workspace.name,
  role: membership.role.toLowerCase() as WorkspaceRole,
})
