import type { UserOption } from '@/types/user'

/*
 * A user with no membership is a real state, not an error: the session is valid
 * but the account belongs to no workspace, so the bar says so instead of
 * rendering an empty line.
 */
export const getMembershipLabel = (userOption?: UserOption): string =>
  userOption
    ? `${userOption.workspaceName} · ${userOption.role}`
    : 'No workspace membership'
