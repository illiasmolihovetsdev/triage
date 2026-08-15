'use client'

import { Button } from '@/components/Button'
import { useSignIn } from '@/components/UserPicker/hooks'
import type { UserPickerProps } from '@/components/UserPicker/types'

export const UserPicker = ({
  userOptionList,
  currentUserId,
}: UserPickerProps) => {
  const { pendingUserId, errorMessage, isSignInDisabled, handleSignIn } =
    useSignIn(currentUserId)

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
          {userOptionList.map((userOption) => {
            const isPending = pendingUserId === userOption.id
            const isSignedIn = userOption.id === currentUserId
            let buttonLabel = 'Sign in'

            if (isSignedIn) {
              buttonLabel = 'Signed in'
            } else if (isPending) {
              buttonLabel = 'Signing in...'
            }

            return (
              <tr key={userOption.id} className="border-b border-zinc-200">
                <td className="py-2 pr-4">
                  <span className="text-zinc-900">{userOption.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {userOption.email}
                  </span>
                </td>
                <td className="py-2 pr-4 text-zinc-700">
                  {userOption.workspaceName}
                </td>
                <td className="py-2 pr-4 text-zinc-700">{userOption.role}</td>
                <td className="py-2 text-right">
                  <Button
                    label={buttonLabel}
                    onClick={() => handleSignIn(userOption.id)}
                    isDisabled={isSignInDisabled || isSignedIn}
                  />
                </td>
              </tr>
            )
          })}
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
}
