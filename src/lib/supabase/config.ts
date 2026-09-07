/** Returns true when Supabase cloud auth is configured. */
export function isCloudMode(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url) {
    throw new Error('Missing VITE_SUPABASE_URL')
  }
  return url
}

export function getSupabaseAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY')
  }
  return key
}
