'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSignIn } from '@/services/auth'
import type { UseSignInResult } from '@/components/UserPicker/types'
import {
  ALREADY_SIGNED_IN_MESSAGE,
  isAlreadySignedInAsRequestedUser,
} from '@/utils/login'

/*
 * Sign-in state for the picker.
 *
 * The component renders; this decides what happens on click. The refresh on
 * success is what makes the server re-render with the new cookie, so the page
 * reflects the session the server actually issued rather than an optimistic
 * guess made in the browser.
 */
export const useSignIn = (currentUserId: string | null): UseSignInResult => {
  const router = useRouter()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSignIn = async (userId: string) => {
    if (isAlreadySignedInAsRequestedUser(currentUserId, userId)) {
      setErrorMessage(ALREADY_SIGNED_IN_MESSAGE)
      return
    }

    setPendingUserId(userId)
    setErrorMessage(null)

    const signInResult = await fetchSignIn(userId)

    if (!signInResult.isSuccess) {
      setErrorMessage(signInResult.errorMessage)
      setPendingUserId(null)
      return
    }

    router.refresh()
  }

  return {
    pendingUserId,
    errorMessage,
    isSignInDisabled: pendingUserId !== null,
    handleSignIn,
  }
}
