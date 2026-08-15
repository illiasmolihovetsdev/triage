'use client'

import { memo, useCallback } from 'react'
import { Button } from '@/components/Button'
import type { UserRowProps } from '@/components/UserPicker/UserRow/types'

/*
 * A row exists as its own component for one reason: it binds the user ID to the
 * click handler with useCallback. Rendering the button inline in the table would
 * mean a new arrow function per row per render, which defeats the memo on Button.
 */
export const UserRow = memo(
  ({
    userOption,
    isPending,
    isDisabled,
    isSignedIn,
    onSignIn,
  }: UserRowProps) => {
    const handleSignInClick = useCallback(() => {
      onSignIn(userOption.id)
    }, [onSignIn, userOption.id])

    const buttonLabel = isSignedIn
      ? 'Signed in'
      : isPending
        ? 'Signing in...'
        : 'Sign in'

    return (
      <tr className="border-b border-zinc-200">
        <td className="py-2 pr-4">
          <span className="text-zinc-900">{userOption.name}</span>
          <span className="ml-2 text-xs text-zinc-500">{userOption.email}</span>
        </td>
        <td className="py-2 pr-4 text-zinc-700">{userOption.workspaceName}</td>
        <td className="py-2 pr-4 text-zinc-700">{userOption.role}</td>
        <td className="py-2 text-right">
          <Button
            label={buttonLabel}
            onClick={handleSignInClick}
            isDisabled={isDisabled || isSignedIn}
          />
        </td>
      </tr>
    )
  }
)

UserRow.displayName = 'UserRow'
