'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSignOut } from '@/services/auth'
import type { UseSignOutResult } from '@/components/CurrentUserBar/types'

/*
 * On success the cookie is already cleared, so navigation to / is a server
 * render of the signed-out home page rather than an optimistic guess.
 */
export const useSignOut = (): UseSignOutResult => {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setErrorMessage(null)

    const signOutResult = await fetchSignOut()

    if (!signOutResult.isSuccess) {
      setErrorMessage(signOutResult.errorMessage)
      setIsSigningOut(false)
      return
    }

    router.push('/')
  }

  return { isSigningOut, errorMessage, handleSignOut }
}
