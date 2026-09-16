import { createServerFn } from '@tanstack/react-start'

export const getAuthSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { createServerSupabase } = await import('#/lib/supabase/server')
  const { supabase } = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { userId: user?.id ?? null }
})
