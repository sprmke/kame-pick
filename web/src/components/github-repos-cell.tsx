import Link from "next/link";
import { Badge } from "@/components/ui/badge";

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
  const errorLabel =
    githubFetchError?.toLowerCase().includes("rate")
      ? "Rate limited"
      : githubFetchError
        ? "Failed"
        : null;

  const label =
    githubRepoCount != null
      ? `${githubRepoCount} ${githubRepoCount === 1 ? "repo" : "repos"}`
      : errorLabel ?? "…";

  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5"
      title={githubFetchError ?? (githubUsername ? `@${githubUsername}` : href)}
    >
      <Badge
        variant={
          githubRepoCount != null && githubRepoCount > 0
            ? "success"
            : githubFetchError
              ? "danger"
              : "default"
        }
      >
        {label}
      </Badge>
      {githubUsername && (
        <span className="text-xs text-zinc-500">@{githubUsername}</span>
      )}
    </Link>
  );
}
