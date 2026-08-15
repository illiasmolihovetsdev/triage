export const ALREADY_SIGNED_IN_CODE = 'ALREADY_SIGNED_IN'
export const ALREADY_SIGNED_IN_MESSAGE = 'Already signed in as this user.'

/*
 * True when the session already names the user the client is asking to become.
 * Switching to a different seeded user is still allowed; repeating the current
 * identity is not.
 */
export const isAlreadySignedInAsRequestedUser = (
  sessionUserId: string | null,
  requestedUserId: string
): boolean => sessionUserId === requestedUserId
