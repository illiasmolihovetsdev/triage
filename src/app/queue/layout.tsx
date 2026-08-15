import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

/*
 * The layout runs before the page Suspense boundary. Checking the session
 * here means an anonymous request is redirected instead of sitting on
 * loading.tsx while the page decides it cannot render.
 */
export default async function QueueLayout({
  children,
}: LayoutProps<'/queue'>) {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect('/')
  }

  return children
}
