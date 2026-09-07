
import { PER_PAGE_OPTIONS } from '#/lib/candidates-pagination'
import { useCandidatesNavigate } from '#/lib/router-helpers'

export function CandidatesPagination({
  page,
  perPage,
  total,
  totalPages,
}: {
  page: number
  perPage: number
  total: number
  totalPages: number
}) {
  const navigate = useCandidatesNavigate()
  const start = total === 0 ? 0 : (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-500">
        {total === 0 ? 'No candidates' : `Showing ${start}–${end} of ${total}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span>Rows</span>
          <select
            value={perPage}
            onChange={(e) => navigate({ per_page: e.target.value, page: '1' })}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => navigate({ page: String(page - 1) })}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
        >
          Previous
        </button>
        <span className="text-sm text-zinc-500">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => navigate({ page: String(page + 1) })}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
        >
          Next
        </button>
      </div>
    </div>
  )
}
