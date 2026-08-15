'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSignOut } from '@/services/auth'
import type { UseSignOutResult } from '@/components/CurrentUserBar/types'

/*
 * The refresh on success is what re-renders the server tree with the cleared
 * cookie, so the page shows the session the server actually ended rather than
 * an optimistic guess made in the browser.
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

    router.refresh()
  }

  return { isSigningOut, errorMessage, handleSignOut }
}
