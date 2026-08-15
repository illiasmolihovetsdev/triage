import 'server-only'

import type { PrismaClient } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import { notify } from '@/lib/notify'

/*
 * One delivery attempt for a PENDING row. Called from after() so resolve can
 * return before notify() sleeps. Failures are stored, not retried. A row that
 * is already SENT or FAILED is left alone, including on an idempotent resolve
 * retry.
 */
const getNotificationErrorMessage = (notifyError: unknown): string => {
  if (notifyError instanceof Error && notifyError.message !== '') {
    return notifyError.message
  }

  return 'Notification delivery failed.'
}

export const dispatchNotificationAttemptWithClient = async (
  database: PrismaClient,
  itemId: string,
  sendNotification: () => Promise<void> = notify
): Promise<void> => {
  const attemptRecord = await database.notificationAttempt.findUnique({
    where: { itemId },
    select: { status: true },
  })

  if (attemptRecord?.status !== 'PENDING') {
    return
  }

  try {
    await sendNotification()
    await database.notificationAttempt.updateMany({
      where: { itemId, status: 'PENDING' },
      data: {
        status: 'SENT',
        finishedAt: new Date(),
        error: null,
      },
    })
  } catch (notifyError: unknown) {
    await database.notificationAttempt.updateMany({
      where: { itemId, status: 'PENDING' },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: getNotificationErrorMessage(notifyError),
      },
    })
  }
}

export const dispatchNotificationAttempt = (itemId: string): Promise<void> =>
  dispatchNotificationAttemptWithClient(prisma, itemId)
