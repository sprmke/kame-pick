import { Link, createFileRoute } from '@tanstack/react-router'
import { listReportsFn } from '#/server/functions'

export const Route = createFileRoute('/reports/')({
  loader: () => listReportsFn(),
  component: ReportsPage,
})

function ReportsPage() {
  const { reports } = Route.useLoaderData()

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Saved rankings</h1>
        <Link to="/analyze" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
          New analysis
        </Link>
      </div>
      {reports.length === 0 ? (
        <p className="text-zinc-500">No saved reports yet. Run an analysis from Rank & Analyze.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                to="/reports/$id"
                params={{ id: String(r.id) }}
                className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="font-semibold">{r.name}</p>
                <p className="mt-1 text-sm text-zinc-500">{new Date(r.created_at).toLocaleString()}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
