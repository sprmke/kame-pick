import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, GitBranch, Mail, Star, Users } from 'lucide-react'
import { Card, CardTitle } from '#/components/ui/card'
import { getDashboardFn } from '#/server/functions'

export const Route = createFileRoute('/')({
  loader: () => getDashboardFn(),
  component: DashboardPage,
})

function DashboardPage() {
  const data = Route.useLoaderData()

  const stats = [
    { label: 'Total applicants', value: data.total_candidates, icon: Users },
    { label: 'With GitHub', value: data.with_github, icon: GitBranch },
    { label: 'With resume PDF', value: data.with_attachments, icon: Mail },
    { label: 'Starred', value: data.starred_count, icon: Star },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-zinc-500">
          {data.role} · {data.total_candidates} synced candidates
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">{label}</p>
                <p className="mt-1 text-3xl font-bold">{value}</p>
              </div>
              <Icon className="h-8 w-8 text-indigo-500 opacity-60" />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Pipeline status</CardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            {Object.entries(data.status_counts).length === 0 ? (
              <p className="text-zinc-500">No status tags yet — open candidates to shortlist.</p>
            ) : (
              Object.entries(data.status_counts).map(([status, count]) => (
                <div
                  key={status}
                  className="flex justify-between border-b border-zinc-100 py-2 dark:border-zinc-800"
                >
                  <dt className="capitalize">{status.replace(/_/g, ' ')}</dt>
                  <dd className="font-semibold">{count}</dd>
                </div>
              ))
            )}
          </dl>
        </Card>

        <Card>
          <CardTitle>Quick actions</CardTitle>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              to="/analyze"
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Run ranking analysis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/sync"
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Sync Gmail applicants
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/candidates"
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Browse all candidates
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            {data.reports_count} saved reports · {data.analysis_runs_count} analysis runs
          </p>
        </Card>
      </div>
    </div>
  )
}
