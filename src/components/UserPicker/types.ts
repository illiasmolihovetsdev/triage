import type { UserOption } from '@/types/user'

export interface UserPickerProps {
  userOptionList: UserOption[]
  currentUserId: string | null
}

export interface UseSignInResult {
  pendingUserId: string | null
  errorMessage: string | null
  isSignInDisabled: boolean
  handleSignIn: (userId: string) => void
}
