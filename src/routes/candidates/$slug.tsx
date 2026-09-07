import { Link, createFileRoute } from '@tanstack/react-router'
import { CandidateActions } from '#/components/candidates/candidate-actions'
import { ResumeSection } from '#/components/candidates/resume-section'
import { CandidateScoreBadges, ScoreBreakdownCard } from '#/components/candidates/score-breakdown-card'
import { CandidateEmailPanel } from '#/components/candidate-email-panel'
import { CandidateLinksPanel } from '#/components/candidate-links-panel'
import { getCandidateFn } from '#/server/functions'

export const Route = createFileRoute('/candidates/$slug')({
  validateSearch: (search: Record<string, unknown>) => ({
    run_id: search.run_id ? Number(search.run_id) : undefined,
  }),
  loader: ({ params }) => getCandidateFn({ data: params.slug }),
  component: CandidateDetailPage,
})

function CandidateDetailPage() {
  const candidate = Route.useLoaderData()
  const { slug } = Route.useParams()
  const { run_id: analysisRunId } = Route.useSearch()
  const score = candidate.score!

  return (
    <div className="p-8">
      <Link to="/candidates" className="text-sm text-indigo-600 hover:underline">
        ← Back to candidates
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">{candidate.name || slug}</h1>
        <p className="text-zinc-500">{candidate.email}</p>
        <p className="mt-1 text-sm text-zinc-500">{candidate.subject}</p>
        <CandidateScoreBadges score={score} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ScoreBreakdownCard score={score} />
        <CandidateActions
          className="h-full"
          slug={slug}
          initialNote={
            candidate.note ?? { slug, status: 'new', starred: false, notes: '', tags: [] }
          }
        />
        <CandidateLinksPanel
          slug={slug}
          githubUrls={candidate.links.github}
          linkedinUrls={candidate.links.linkedin}
          portfolioUrls={candidate.links.portfolio_and_other}
        />
        <ResumeSection slug={slug} attachments={candidate.attachments} extracted={candidate.extracted} />
        <CandidateEmailPanel slug={slug} analysisRunId={analysisRunId} />
      </div>
    </div>
  )
}
