import { ScoreBadge, TierBadge } from "#/components/score-badge";
import { Badge } from "#/components/ui/badge";
import { Card, CardTitle } from "#/components/ui/card";
import type { ScoreBreakdown } from "#/lib/api";

function ScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function CandidateScoreBadges({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ScoreBadge score={score} />
      <TierBadge tier={score.experience_tier} />
      {score.filipino_verified ? (
        <Badge variant="success">PH verified</Badge>
      ) : (
        <Badge variant="warning">PH unverified</Badge>
      )}
      {score.auto_pass && <Badge variant="danger">Auto-pass</Badge>}
    </div>
  );
}

export function ScoreBreakdownCard({ score }: { score: ScoreBreakdown }) {
  return (
    <Card className="h-full">
      <CardTitle>Score breakdown</CardTitle>
      <dl className="mt-4 space-y-2 text-sm">
        <ScoreRow label="Experience" value={`${score.experience_years ?? "?"} yrs · ${score.experience_tier}`} />
        <ScoreRow label="Tech stack" value={`${score.tech_stack_score}/30`} />
        <ScoreRow label="Required met" value={score.tech_required_met.join(", ") || "—"} />
        <ScoreRow label="Preferred" value={score.tech_preferred_met.slice(0, 8).join(", ") || "—"} />
        <ScoreRow label="Git" value={score.git_evidence || "—"} />
        <ScoreRow label="Honors" value={score.honors_found.join(", ") || "—"} />
        <ScoreRow label="AI tools" value={score.ai_tools_found.join(", ") || "—"} />
        <ScoreRow label="Location" value={score.location_signals.join(", ") || "—"} />
        {score.red_flags.length > 0 && (
          <ScoreRow label="Red flags" value={score.red_flags.join("; ")} />
        )}
      </dl>
    </Card>
  );
}
