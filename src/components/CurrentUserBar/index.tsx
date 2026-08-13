'use client'

import { memo } from 'react'
import { Button } from '@/components/Button'
import { useSignOut } from '@/components/CurrentUserBar/hooks'
import type { CurrentUserBarProps } from '@/components/CurrentUserBar/types'

export const CurrentUserBar = memo(
  ({ userName, membershipLabel }: CurrentUserBarProps) => {
    const { isSigningOut, errorMessage, handleSignOut } = useSignOut()

    return (
      <section className="mb-8 border border-zinc-300 bg-zinc-50 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="text-zinc-900">
              Signed in as <span className="font-medium">{userName}</span>
            </p>
            <p className="mt-0.5 text-zinc-600">{membershipLabel}</p>
          </div>

          <div className="text-right">
            <Button
              label={isSigningOut ? 'Signing out...' : 'Sign out'}
              onClick={handleSignOut}
              isDisabled={isSigningOut}
            />
            {errorMessage ? (
              <p role="alert" className="mt-1 text-xs text-red-700">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    )
  }
)

CurrentUserBar.displayName = 'CurrentUserBar'
