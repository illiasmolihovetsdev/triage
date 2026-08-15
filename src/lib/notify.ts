/*
 * The assignment's notification function. It is slow and flaky on purpose.
 * Do not retry it, do not wrap it, and do not await it on the resolve path.
 * Delivery is scheduled after the response (the next step). This file only
 * defines the unreliable call.
 */
const NOTIFICATION_DELAY_MS = 1000
const NOTIFICATION_FAILURE_RATE = 0.2

export const notify = async (): Promise<void> => {
  await new Promise<void>((settle) => {
    setTimeout(settle, NOTIFICATION_DELAY_MS)
  })

  if (Math.random() < NOTIFICATION_FAILURE_RATE) {
    throw new Error('Notification delivery failed.')
  }
}
