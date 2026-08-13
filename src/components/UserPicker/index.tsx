'use client'

import { memo } from 'react'
import { UserRow } from '@/components/UserPicker/UserRow'
import { useSignIn } from '@/components/UserPicker/hooks'
import type { UserPickerProps } from '@/components/UserPicker/types'

export const UserPicker = memo(({ userOptionList }: UserPickerProps) => {
  const { pendingUserId, errorMessage, isSignInDisabled, handleSignIn } =
    useSignIn()

  if (userOptionList.length === 0) {
    return (
      <p className="border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-600">
        No users found. Run `npm run seed` to create them.
      </p>
    )
  }

  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Workspace</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {userOptionList.map((userOption) => (
            <UserRow
              key={userOption.id}
              userOption={userOption}
              isPending={pendingUserId === userOption.id}
              isDisabled={isSignInDisabled}
              onSignIn={handleSignIn}
            />
          ))}
        </tbody>
      </table>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
})

UserPicker.displayName = 'UserPicker'
