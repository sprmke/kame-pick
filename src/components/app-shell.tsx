import { Outlet, useRouterState } from '@tanstack/react-router'
import { Sidebar } from '#/components/sidebar'
import { isPublicRoute } from '#/lib/supabase/client'

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAuthPage = isPublicRoute(pathname) && !pathname.startsWith('/auth/callback')

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}