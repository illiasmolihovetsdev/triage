import type { UserOption } from '@/types/user'

export interface UserRowProps {
  userOption: UserOption
  isPending: boolean
  isDisabled: boolean
  isSignedIn: boolean
  onSignIn: (userId: string) => void
}
