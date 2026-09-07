'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { createBrowserSupabase } from '#/lib/supabase/client'

export function UserMenu() {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabase()
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  async function signOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
      <p className="truncate text-xs text-zinc-500">{email ?? '…'}</p>
      <button
        type="button"
        onClick={signOut}
        className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  )
}
