import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CurrentUserBar } from '@/components/CurrentUserBar'
import { QueueTable } from '@/components/QueueTable'
import { getTotalPageCount } from '@/components/QueueTable/QueuePagination/utils'
import { requireCallerMembership } from '@/lib/authz'
import { fetchQueuePage } from '@/services/items'
import { canRolePerformAction } from '@/utils/authorization'
import {
  getCurrentQueuePage,
  getQueryStringValue,
  getQueueStatusFilter,
} from './utils'

export default async function QueuePage({
  searchParams,
}: PageProps<'/queue'>) {
  const callerMembershipResult = await requireCallerMembership()

  if (!callerMembershipResult.isAuthorized) {
    if (callerMembershipResult.statusCode === 401) {
      redirect('/')
    }

    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <p
          role="alert"
          className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {callerMembershipResult.message}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/" className="underline">
            Back to sign in
          </Link>
        </p>
      </main>
    )
  }

  const resolvedSearchParams = await searchParams
  const cursorToken = getQueryStringValue(resolvedSearchParams.cursor)
  const beforeToken = getQueryStringValue(resolvedSearchParams.before)
  const statusFilter = getQueueStatusFilter(resolvedSearchParams.status)
  const currentPage = getCurrentQueuePage(
    cursorToken,
    beforeToken,
    resolvedSearchParams.page
  )
  const { user, membership } = callerMembershipResult
  const queuePageResult = await fetchQueuePage(membership.workspaceId, {
    cursorToken,
    beforeToken,
    statusFilter,
  })
  const membershipLabel = `${membership.workspaceName} · ${membership.role.toLowerCase()}`
  const canClaim = canRolePerformAction(membership.role, 'claim')
  const canResolve = canRolePerformAction(membership.role, 'resolve')
  const canRelease = canRolePerformAction(membership.role, 'release')
  const tableKey = `${statusFilter}:${cursorToken ?? beforeToken ?? 'first'}`

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8 border-b border-zinc-300 pb-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Queue</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {membership.workspaceName}. Claim is exclusive: if two people
              click at once, one wins and the other sees who holds it.
            </p>
          </div>
          <Link href="/" className="text-sm underline">
            Switch user
          </Link>
        </div>
      </header>

      <CurrentUserBar
        userName={user.name}
        membershipLabel={membershipLabel}
      />

      {queuePageResult.isSuccess ? (
        <QueueTable
          key={tableKey}
          itemList={queuePageResult.itemList}
          shownCount={queuePageResult.shownCount}
          totalCount={queuePageResult.totalCount}
          currentUserId={user.id}
          canClaim={canClaim}
          canResolve={canResolve}
          canRelease={canRelease}
          statusFilter={statusFilter}
          pagination={{
            currentPage,
            totalPages: getTotalPageCount(
              queuePageResult.totalCount,
              queuePageResult.pageSize
            ),
            nextCursor: queuePageResult.nextCursor,
            prevCursor: queuePageResult.prevCursor,
            statusFilter,
          }}
        />
      ) : (
        <p
          role="alert"
          className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {queuePageResult.errorMessage}
        </p>
      )}
    </main>
  )
}
