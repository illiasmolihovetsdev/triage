import 'server-only'

import { prisma } from '@/lib/db'
import type {
  CallerMembershipRecord,
  MembershipAuthRecord,
} from '@/types/authz'

/*
 * Membership is the authorization source of truth. A missing row means the
 * caller has no relationship to this workspace, which requireItemAction treats
 * as "item not found" so that cross-workspace probes do not leak existence.
 */
export const fetchMembershipAuthRecord = async (
  userId: string,
  workspaceId: string
): Promise<MembershipAuthRecord | null> => {
  const membershipRecord = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
    select: { userId: true, workspaceId: true, role: true },
  })

  return membershipRecord
}

export const fetchCallerMembershipList = async (
  userId: string
): Promise<CallerMembershipRecord[]> => {
  const membershipRecordList = await prisma.workspaceMembership.findMany({
    where: { userId },
    select: {
      userId: true,
      workspaceId: true,
      role: true,
      workspace: { select: { name: true } },
    },
  })

  return membershipRecordList.map((membershipRecord) => ({
    userId: membershipRecord.userId,
    workspaceId: membershipRecord.workspaceId,
    workspaceName: membershipRecord.workspace.name,
    role: membershipRecord.role,
  }))
}
