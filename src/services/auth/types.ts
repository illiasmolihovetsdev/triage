/*
 * Services return an explicit result rather than throwing, so callers have to
 * deal with failure at the call site instead of relying on a try/catch further
 * up that may or may not exist.
 */
export type AuthRequestResult =
  | { isSuccess: true }
  | { isSuccess: false; errorMessage: string }
