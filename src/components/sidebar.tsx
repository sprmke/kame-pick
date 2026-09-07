import { BarChart3, FileText, LayoutDashboard, RefreshCw, Settings, Sparkles, Users } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { APP_NAME, APP_TAGLINE } from '#/lib/brand'
import { cn } from '#/lib/utils'
import { UserMenu } from '#/components/user-menu'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/candidates', label: 'Candidates', icon: Users },
  { href: '/analyze', label: 'Rank & Analyze', icon: Sparkles },
  { href: '/reports', label: 'Rankings', icon: FileText },
  { href: '/sync', label: 'Gmail Sync', icon: RefreshCw },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
        <BarChart3 className="h-6 w-6 text-indigo-600" />
        <div>
          <p className="text-sm font-bold">{APP_NAME}</p>
          <p className="text-xs text-zinc-500">{APP_TAGLINE}</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
      <UserMenu />
    </aside>
  )
}
