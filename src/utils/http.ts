export const readErrorMessage = async (
  response: Response,
  fallbackMessage: string
): Promise<string> => {
  try {
    const failureBody: unknown = await response.json()

    if (
      typeof failureBody === 'object' &&
      failureBody !== null &&
      'message' in failureBody &&
      typeof failureBody.message === 'string'
    ) {
      return failureBody.message
    }

    return fallbackMessage
  } catch {
    return fallbackMessage
  }
}
