import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function createBrowserSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in .env.local')
  }
  if (url.includes('your-project') || key.includes('your-anon')) {
    throw new Error(
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are still placeholders — copy the same values as SUPABASE_URL and SUPABASE_ANON_KEY in .env.local, then restart the dev server',
    )
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, key)
  }
  return browserClient
}

export const PUBLIC_ROUTES = ['/login', '/signup', '/auth/callback', '/api/gmail/callback']

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}
