import type { AuthRequestResult } from '@/services/auth/types'

/*
 * Browser-to-server calls for authentication. Components never call fetch
 * directly: keeping the transport here means a change to the endpoint, the
 * payload, or the error shape happens in one place.
 */

const readErrorMessage = async (
  response: Response,
  fallbackMessage: string
): Promise<string> => {
  try {
    const failureBody = await response.json()

    return typeof failureBody?.message === 'string'
      ? failureBody.message
      : fallbackMessage
  } catch {
    return fallbackMessage
  }
}

export const fetchSignIn = async (
  userId: string
): Promise<AuthRequestResult> => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      return {
        isSuccess: false,
        errorMessage: await readErrorMessage(response, 'Could not sign in.'),
      }
    }

    return { isSuccess: true }
  } catch {
    return { isSuccess: false, errorMessage: 'Network error. Could not sign in.' }
  }
}

export const fetchSignOut = async (): Promise<AuthRequestResult> => {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' })

    if (!response.ok) {
      return {
        isSuccess: false,
        errorMessage: await readErrorMessage(response, 'Could not sign out.'),
      }
    }

    return { isSuccess: true }
  } catch {
    return {
      isSuccess: false,
      errorMessage: 'Network error. Could not sign out.',
    }
  }
}
