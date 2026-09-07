import { createClient } from '@supabase/supabase-js'

export function createBrowserSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')
  }
  return createClient(url, key)
}

export const PUBLIC_ROUTES = ['/login', '/signup', '/auth/callback']

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}
