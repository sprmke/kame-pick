import { createFileRoute } from '@tanstack/react-router'
import { AnalyzeWorkspace } from '#/components/analyze-workspace'
import { getFilterOptionsFn, getJobCriteriaFn, listReportsFn } from '#/server/functions'

export const Route = createFileRoute('/analyze/')({
  loader: async () => {
    const [criteria, filterOptions, reports] = await Promise.all([
      getJobCriteriaFn(),
      getFilterOptionsFn(),
      listReportsFn(),
    ])
    return {
      criteriaContent: criteria.raw,
      criteriaPath: 'config/job-criteria.yaml',
      filterOptions,
      initialRuns: reports.reports.slice(0, 5),
    }
  },
  component: AnalyzePage,
})

function AnalyzePage() {
  const data = Route.useLoaderData()
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Rank & Analyze</h1>
      <p className="mt-1 text-zinc-500">Filter applicants, preview the pool, and save ranked reports.</p>
      <AnalyzeWorkspace {...data} />
    </div>
  )
}
