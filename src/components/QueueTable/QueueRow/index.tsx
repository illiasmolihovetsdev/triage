'use client'

import { Button } from '@/components/Button'
import type { QueueRowProps } from '@/components/QueueTable/QueueRow/types'
import {
  canShowClaimButton,
  canShowReleaseButton,
  canShowResolveButton,
  getClaimButtonLabel,
  getClaimerLabel,
  getNotificationLabel,
  getNotificationTextClassName,
  getReleaseButtonLabel,
  getResolveButtonLabel,
  getRowFeedbackMessage,
} from '@/components/QueueTable/utils'

export const QueueRow = ({
  queueItem,
  rowState,
  currentUserId,
  canClaim,
  canResolve,
  canRelease,
  onClaim,
  onResolve,
  onRelease,
}: QueueRowProps) => {
  const shouldShowClaimButton = canShowClaimButton(canClaim, queueItem)
  const shouldShowResolveButton = canShowResolveButton(
    canResolve,
    queueItem,
    currentUserId
  )
  const shouldShowReleaseButton = canShowReleaseButton(
    canRelease,
    queueItem,
    currentUserId
  )
  const feedbackMessage = getRowFeedbackMessage(rowState)
  const isActionDisabled = rowState.kind === 'loading'
  const notificationLabel = getNotificationLabel(queueItem)
  const notificationTextClassName = getNotificationTextClassName(queueItem)

  const handleClaimClick = () => {
    onClaim(queueItem.id)
  }

  const handleResolveClick = () => {
    onResolve(queueItem.id)
  }

  const handleReleaseClick = () => {
    onRelease(queueItem.id)
  }

  return (
    <tr className="border-b border-zinc-200">
      <td className="py-2 pr-4 text-zinc-900">{queueItem.title}</td>
      <td className="py-2 pr-4 text-zinc-700">{queueItem.status}</td>
      <td className="py-2 pr-4 text-zinc-700">{getClaimerLabel(queueItem)}</td>
      <td className={`py-2 pr-4 ${notificationTextClassName}`}>
        {notificationLabel}
      </td>
      <td className="py-2 text-right">
        <div className="flex flex-wrap justify-end gap-1">
          {shouldShowClaimButton ? (
            <Button
              label={getClaimButtonLabel(rowState)}
              onClick={handleClaimClick}
              isDisabled={isActionDisabled}
            />
          ) : null}
          {shouldShowResolveButton ? (
            <Button
              label={getResolveButtonLabel(rowState)}
              onClick={handleResolveClick}
              isDisabled={isActionDisabled}
            />
          ) : null}
          {shouldShowReleaseButton ? (
            <Button
              label={getReleaseButtonLabel(rowState)}
              onClick={handleReleaseClick}
              isDisabled={isActionDisabled}
            />
          ) : null}
        </div>
        {feedbackMessage ? (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {feedbackMessage}
          </p>
        ) : null}
      </td>
    </tr>
  )
}
