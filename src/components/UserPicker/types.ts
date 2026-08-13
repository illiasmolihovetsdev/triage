import type { UserOption } from '@/types/user'

export interface UserPickerProps {
  userOptionList: UserOption[]
}

export interface UseSignInResult {
  pendingUserId: string | null
  errorMessage: string | null
  isSignInDisabled: boolean
  handleSignIn: (userId: string) => void
}
