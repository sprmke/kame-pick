'use client'

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { createBrowserSupabase } from '#/lib/supabase/client'
import { isCloudMode } from '#/lib/supabase/config'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const next = params.get('next') || '/'
    const error = params.get('error_description') ?? params.get('error')

    if (error) {
      navigate({ to: '/login' })
      return
    }

    if (!code) {
      navigate({ to: '/' })
      return
    }

    if (!isCloudMode()) {
      navigate({ to: '/' })
      return
    }

    const supabase = createBrowserSupabase()
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: authError }) => {
        if (authError) {
          navigate({ to: '/login' })
          return
        }
        navigate({ to: next })
      })
      .catch(() => navigate({ to: '/login' }))
  }, [navigate])

  return <p className="text-sm text-zinc-500">Completing sign-in…</p>
}
