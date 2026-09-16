import { createFileRoute } from '@tanstack/react-router'
import { RankingReview } from '#/components/ranking-review'
import { getFilterOptionsFn, getReportFn } from '#/server/functions'

export const Route = createFileRoute('/reports/$id')({
  loader: async ({ params }) => {
    const [report, filterOptions] = await Promise.all([
      getReportFn({ data: Number(params.id) }),
      getFilterOptionsFn(),
    ])
    return { report, filterOptions }
  },
  component: ReportDetailPage,
})

function ReportDetailPage() {
  const { report, filterOptions } = Route.useLoaderData()
  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <RankingReview run={report} filterOptions={filterOptions} />
    </div>
  )
}
