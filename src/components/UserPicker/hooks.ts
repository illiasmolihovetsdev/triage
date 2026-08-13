'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSignIn } from '@/services/auth'
import type { UseSignInResult } from '@/components/UserPicker/types'

/*
 * Sign-in state for the picker.
 *
 * The component renders; this decides what happens on click. The refresh on
 * success is what makes the server re-render with the new cookie, so the page
 * reflects the session the server actually issued rather than an optimistic
 * guess made in the browser.
 */
export const useSignIn = (): UseSignInResult => {
  const router = useRouter()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSignIn = useCallback(
    async (userId: string) => {
      setPendingUserId(userId)
      setErrorMessage(null)

      const signInResult = await fetchSignIn(userId)

      if (!signInResult.isSuccess) {
        setErrorMessage(signInResult.errorMessage)
        setPendingUserId(null)
        return
      }

      router.refresh()
    },
    [router]
  )

  return {
    pendingUserId,
    errorMessage,
    isSignInDisabled: pendingUserId !== null,
    handleSignIn,
  }
}
