'use client'

import { Button } from '@/components/Button'
import type { QueueRowProps } from '@/components/QueueTable/QueueRow/types'
import {
  canShowClaimButton,
  getClaimButtonLabel,
  getClaimerLabel,
  getNotificationLabel,
  getRowFeedbackMessage,
} from '@/components/QueueTable/utils'

export const QueueRow = ({
  queueItem,
  rowState,
  canClaim,
  onClaim,
}: QueueRowProps) => {
  const shouldShowClaimButton = canShowClaimButton(canClaim, queueItem)
  const feedbackMessage = getRowFeedbackMessage(rowState)
  const isClaimDisabled = rowState.kind === 'loading'

  return (
    <tr className="border-b border-zinc-200">
      <td className="py-2 pr-4 text-zinc-900">{queueItem.title}</td>
      <td className="py-2 pr-4 text-zinc-700">{queueItem.status}</td>
      <td className="py-2 pr-4 text-zinc-700">{getClaimerLabel(queueItem)}</td>
      <td className="py-2 pr-4 text-zinc-700">
        {getNotificationLabel(queueItem)}
      </td>
      <td className="py-2 text-right">
        {shouldShowClaimButton ? (
          <Button
            label={getClaimButtonLabel(rowState)}
            onClick={() => onClaim(queueItem.id)}
            isDisabled={isClaimDisabled}
          />
        ) : null}
        {feedbackMessage ? (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {feedbackMessage}
          </p>
        ) : null}
      </td>
    </tr>
  )
}
