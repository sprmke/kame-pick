import { redirect } from '@tanstack/react-router'
import { isPublicRoute } from '#/lib/supabase/client'
import { getAuthSessionFn } from '#/server/auth-session'

/** Redirect unauthenticated users to /login. */
export async function enforceRouteAuth(pathname: string) {
  const { userId } = await getAuthSessionFn()
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  if (userId && isAuthPage) {
    throw redirect({ to: '/' })
  }

  if (!userId && !isPublicRoute(pathname)) {
    throw redirect({
      to: '/login',
      search: pathname !== '/' ? { next: pathname } : {},
    })
  }
}
