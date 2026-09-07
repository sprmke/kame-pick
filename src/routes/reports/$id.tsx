import { createFileRoute } from '@tanstack/react-router'
import { RankingReview } from '#/components/ranking-review'
import { getReportFn } from '#/server/functions'

export const Route = createFileRoute('/reports/$id')({
  loader: ({ params }) => getReportFn({ data: Number(params.id) }),
  component: ReportDetailPage,
})

function ReportDetailPage() {
  const report = Route.useLoaderData()
  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <RankingReview run={report} />
    </div>
  )
}
