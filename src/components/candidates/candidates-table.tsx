import type { MouseEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { GithubReposCell } from '#/components/github-repos-cell'
import { ScoreBadge, TierBadge } from '#/components/score-badge'
import { StatusBadge } from '#/components/status-badge'
import type { CandidateListItem } from '#/lib/api'
import { useCandidatesNavigate, useCandidatesSearch } from '#/lib/router-helpers'
import { cn } from '#/lib/utils'

const COLUMNS = [
  { id: "name", label: "Name", className: "" },
  { id: "score", label: "Score", className: "" },
  { id: "tier", label: "Tier", className: "" },
  { id: "github_repos", label: "GitHub", className: "hidden md:table-cell" },
  { id: "status", label: "Status", className: "" },
  { id: "received_at", label: "Received", className: "hidden lg:table-cell" },
] as const;

export function CandidatesTable({
  candidates,
  sort,
  order,
}: {
  candidates: CandidateListItem[];
  sort: string;
  order: string;
}) {
  const navigate = useCandidatesNavigate()
  const search = useCandidatesSearch()
  const routerNavigate = useNavigate()

  function toggleSort(column: string) {
    if (sort === column) {
      navigate({ sort: column, order: order === 'asc' ? 'desc' : 'asc', page: undefined })
    } else {
      const defaultAsc = column === 'name' || column === 'status'
      navigate({ sort: column, order: defaultAsc ? 'asc' : 'desc', page: undefined })
    }
  }

  function openCandidate(slug: string, e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      window.open(`/candidates/${slug}`, '_blank', 'noopener,noreferrer')
      return
    }
    routerNavigate({ to: '/candidates/$slug', params: { slug } })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
          <tr>
            {COLUMNS.map((col) => {
              const active = sort === col.id;
              const Icon = active
                ? order === "asc"
                  ? ArrowUp
                  : ArrowDown
                : ArrowUpDown;
              return (
                <th key={col.id} className={cn("px-4 py-3 font-medium", col.className)}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.id)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200",
                      active && "text-indigo-600 dark:text-indigo-400",
                    )}
                  >
                    {col.label}
                    <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.slug}
              role="link"
              tabIndex={0}
              onClick={(e) => openCandidate(c.slug, e)}
              onAuxClick={(e) => openCandidate(c.slug, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(`/candidates/${c.slug}`);
              }}
              className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
            >
              <td className="px-4 py-3">
                <p className="font-medium">
                  {c.note?.starred && <span className="mr-1 text-amber-500">★</span>}
                  {c.name || c.slug}
                </p>
                <p className="text-xs text-zinc-500">{c.email}</p>
              </td>
              <td className="px-4 py-3">
                <ScoreBadge score={c.score} />
              </td>
              <td className="px-4 py-3">
                <TierBadge tier={c.score?.experience_tier} />
              </td>
              <td
                className="px-4 py-3 hidden md:table-cell"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <GithubReposCell
                  githubUrls={c.github_urls}
                  githubUsername={c.github_username}
                  githubRepoCount={c.github_repo_count}
                  githubFetchError={c.github_fetch_error}
                />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={c.note?.status ?? "new"} />
              </td>
              <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">
                {c.received_at ? new Date(c.received_at).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <p className="p-8 text-center text-zinc-500">No candidates match your filters.</p>
      )}
    </div>
  );
}
