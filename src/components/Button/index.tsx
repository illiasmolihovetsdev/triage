'use client'

import { memo } from 'react'
import type { ButtonProps } from '@/components/Button/types'

/*
 * The one place button styling is defined. Callers pass a label and a handler;
 * the claim, resolve, and release controls that R1 and R2 add should reuse this
 * rather than repeat the class list.
 *
 * A button exists to be clicked, so this is always a Client Component and the
 * memo is meaningful: callers pass handlers wrapped in useCallback.
 */
export const Button = memo(
  ({ label, onClick, isDisabled = false }: ButtonProps) => (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="border border-zinc-400 px-3 py-1 text-sm text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
)

Button.displayName = 'Button'
