export interface CurrentUserBarProps {
  userName: string
  membershipLabel: string
}

export interface UseSignOutResult {
  isSigningOut: boolean
  errorMessage: string | null
  handleSignOut: () => void
}
