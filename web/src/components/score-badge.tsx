import { Badge } from "@/components/ui/badge";
import type { ScoreBreakdown } from "@/lib/api";

export function ScoreBadge({ score }: { score?: ScoreBreakdown }) {
  if (!score) return <Badge>—</Badge>;
  const total = score.total_score;
  const variant =
    total >= 80 ? "success" : total >= 60 ? "info" : total >= 40 ? "warning" : "danger";
  return <Badge variant={variant}>{total}/100</Badge>;
}

export function TierBadge({ tier }: { tier?: string }) {
  const map: Record<string, { label: string; variant: "success" | "info" | "warning" | "danger" }> = {
    tier_a: { label: "Tier A", variant: "success" },
    tier_b: { label: "Tier B", variant: "info" },
    auto_pass: { label: "Auto-pass", variant: "danger" },
    unknown: { label: "Unknown", variant: "warning" },
  };
  const item = map[tier || "unknown"] || map.unknown;
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
