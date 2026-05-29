import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateActions } from "@/app/candidates/[slug]/candidate-actions";
import { CandidateEmailPanel } from "@/components/candidate-email-panel";
import { CandidateLinksPanel } from "@/components/candidate-links-panel";
import { ResumeSection } from "@/app/candidates/[slug]/resume-section";
import { ScoreBadge, TierBadge } from "@/components/score-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
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

  const sc = candidate.score;

  return (
    <div className="p-8">
      <Link href="/candidates" className="text-sm text-indigo-600 hover:underline">
        ← Back to candidates
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">{candidate.name || slug}</h1>
        <p className="text-zinc-500">{candidate.email}</p>
        <p className="mt-1 text-sm text-zinc-500">{candidate.subject}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ScoreBadge score={sc} />
          <TierBadge tier={sc.experience_tier} />
          {sc.filipino_verified ? (
            <Badge variant="success">PH verified</Badge>
          ) : (
            <Badge variant="warning">PH unverified</Badge>
          )}
          {sc.auto_pass && <Badge variant="danger">Auto-pass</Badge>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardTitle>Score breakdown</CardTitle>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Experience" value={`${sc.experience_years ?? "?"} yrs · ${sc.experience_tier}`} />
            <Row label="Tech stack" value={`${sc.tech_stack_score}/30`} />
            <Row label="Required met" value={sc.tech_required_met.join(", ") || "—"} />
            <Row label="Preferred" value={sc.tech_preferred_met.slice(0, 8).join(", ") || "—"} />
            <Row label="Git" value={sc.git_evidence || "—"} />
            <Row label="Honors" value={sc.honors_found.join(", ") || "—"} />
            <Row label="AI tools" value={sc.ai_tools_found.join(", ") || "—"} />
            <Row label="Location" value={sc.location_signals.join(", ") || "—"} />
            {sc.red_flags.length > 0 && (
              <Row label="Red flags" value={sc.red_flags.join("; ")} />
            )}
          </dl>
        </Card>

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
