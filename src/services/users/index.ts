import 'server-only'

import { prisma } from '@/lib/db'
import { mapMembershipToUserOption } from '@/services/users/utils'
import type { UserOption } from '@/types/user'

/*
 * Server-to-database reads for users.
 *
 * The `server-only` import is a guard, not decoration: importing this module
 * from a client component becomes a build error rather than a bundle that
 * quietly ships Prisma, or worse, database credentials, to the browser.
 */
export const fetchUserOptionList = async (): Promise<UserOption[]> => {
  const membershipRecordList = await prisma.workspaceMembership.findMany({
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
      workspace: { select: { name: true } },
    },
    orderBy: [{ workspace: { name: 'asc' } }, { user: { name: 'asc' } }],
  })

  return membershipRecordList.map(mapMembershipToUserOption)
}
