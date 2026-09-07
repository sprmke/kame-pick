import Link from "next/link";
import { Badge } from "@/components/ui/badge";

function githubErrorLabel(error: string | null | undefined): string | null {
  if (!error) return null;
  return error.toLowerCase().includes("rate") ? "Rate limited" : "Failed";
}

function githubRepoLabel(
  repoCount: number | null | undefined,
  errorLabel: string | null,
): string {
  if (repoCount != null) {
    return `${repoCount} ${repoCount === 1 ? "repo" : "repos"}`;
  }
  return errorLabel ?? "…";
}

function githubBadgeVariant(
  repoCount: number | null | undefined,
  fetchError: string | null | undefined,
): "success" | "danger" | "default" {
  if (repoCount != null && repoCount > 0) return "success";
  if (fetchError) return "danger";
  return "default";
}

export function GithubReposCell({
  githubUrls,
  githubUsername,
  githubRepoCount,
  githubFetchError,
}: {
  githubUrls?: string[];
  githubUsername?: string | null;
  githubRepoCount?: number | null;
  githubFetchError?: string | null;
}) {
  if (!githubUrls?.length) {
    return <span className="text-zinc-500">—</span>;
  }

  const href = githubUrls[0];
  const errorLabel = githubErrorLabel(githubFetchError);
  const label = githubRepoLabel(githubRepoCount, errorLabel);

  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5"
      title={githubFetchError ?? (githubUsername ? `@${githubUsername}` : href)}
    >
      <Badge variant={githubBadgeVariant(githubRepoCount, githubFetchError)}>{label}</Badge>
      {githubUsername && <span className="text-xs text-zinc-500">@{githubUsername}</span>}
    </Link>
  );
}
