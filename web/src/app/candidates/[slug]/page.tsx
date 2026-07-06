import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateActions } from "@/app/candidates/[slug]/candidate-actions";
import { CandidateScoreBadges, ScoreBreakdownCard } from "@/app/candidates/[slug]/score-breakdown-card";
import { ResumeSection } from "@/app/candidates/[slug]/resume-section";
import { CandidateEmailPanel } from "@/components/candidate-email-panel";
import { CandidateLinksPanel } from "@/components/candidate-links-panel";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const analysisRunId = query.run_id ? Number(query.run_id) : undefined;
  let candidate;
  try {
    candidate = await api.candidate(slug);
  } catch {
    notFound();
  }

  const score = candidate.score;

  return (
    <div className="p-8">
      <Link href="/candidates" className="text-sm text-indigo-600 hover:underline">
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
            candidate.note ?? {
              slug,
              status: "new",
              starred: false,
              notes: "",
              tags: [],
            }
          }
        />

        <CandidateLinksPanel
          slug={slug}
          githubUrls={candidate.links.github}
          linkedinUrls={candidate.links.linkedin}
          portfolioUrls={candidate.links.portfolio_and_other}
        />

        <ResumeSection
          slug={slug}
          attachments={candidate.attachments}
          extracted={candidate.extracted}
        />

        <CandidateEmailPanel
          slug={slug}
          analysisRunId={Number.isFinite(analysisRunId) ? analysisRunId : undefined}
        />
      </div>
    </div>
  );
}
