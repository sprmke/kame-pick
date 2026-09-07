import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { getRequest } from '@tanstack/react-start/server'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

export function getSupabaseUrl() {
  return requireEnv('SUPABASE_URL')
}

export function getSupabaseAnonKey() {
  return requireEnv('SUPABASE_ANON_KEY')
}

export function createServiceClient() {
  return createClient(getSupabaseUrl(), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function createServerSupabase() {
  const request = getRequest()
  const headers = new Headers()

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get('cookie') ?? ''
        return parseCookieHeader(cookieHeader).filter(
          (c): c is { name: string; value: string } => c.value !== undefined,
        )
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
        }
      },
    },
  })

  return { supabase, headers }
}

export function createBrowserSupabase() {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey())
}
