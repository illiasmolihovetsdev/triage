import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CurrentUserBar } from '@/components/CurrentUserBar'
import { QueueTable } from '@/components/QueueTable'
import { requireCallerMembership } from '@/lib/authz'
import { fetchQueuePage } from '@/services/items'

export default async function QueuePage() {
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

  const { user, membership } = callerMembershipResult
  const queuePageResult = await fetchQueuePage(membership.workspaceId)
  const membershipLabel = `${membership.workspaceName} · ${membership.role.toLowerCase()}`

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8 border-b border-zinc-300 pb-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Queue</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {membership.workspaceName}. No actions yet — claiming arrives next.
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
          itemList={queuePageResult.itemList}
          shownCount={queuePageResult.shownCount}
          totalCount={queuePageResult.totalCount}
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
