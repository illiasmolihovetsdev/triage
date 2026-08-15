import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { fetchUserOptionList } from '@/services/users'
import { CurrentUserBar } from '@/components/CurrentUserBar'
import { getMembershipLabel } from '@/components/CurrentUserBar/utils'
import { UserPicker } from '@/components/UserPicker'

export default async function HomePage() {
  const currentUser = await getCurrentUser()
  const userOptionList = await fetchUserOptionList()
  const currentUserOption = currentUser
    ? userOptionList.find((userOption) => userOption.id === currentUser.id)
    : undefined

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 border-b border-zinc-300 pb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Triage</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Shared work queue. Sign in as a seeded user to continue.
        </p>
      </header>

      {currentUser ? (
        <>
          <CurrentUserBar
            userName={currentUser.name}
            membershipLabel={getMembershipLabel(currentUserOption)}
          />
          <p className="mb-8 text-sm">
            <Link href="/queue" className="underline">
              Open queue
            </Link>
          </p>
        </>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          {currentUser ? 'Switch user' : 'Seeded users'}
        </h2>
        <UserPicker
          userOptionList={userOptionList}
          currentUserId={currentUser?.id ?? null}
        />
      </section>
    </main>
  )
}
