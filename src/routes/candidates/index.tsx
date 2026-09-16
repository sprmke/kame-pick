import { createFileRoute } from '@tanstack/react-router'
import { CandidatesPagination } from '#/components/candidates/candidates-pagination'
import { CandidatesTable } from '#/components/candidates/candidates-table'
import { CandidatesToolbar } from '#/components/candidates/candidates-toolbar'
import { parsePerPage } from '#/lib/candidates-pagination'
import { listCandidatesFn } from '#/server/functions'

export const Route = createFileRoute('/candidates/')({
  validateSearch: (search: Record<string, unknown>): {
    q?: string
    status?: string
    sort?: string
    order?: 'asc' | 'desc'
    page?: number
    per_page?: number
    starred?: string
    github?: string
  } => {
    const q = String(search.q ?? '')
    const status = String(search.status ?? '')
    const sort = String(search.sort ?? 'score')
    const order = (search.order as 'asc' | 'desc') ?? 'desc'
    const page = Number(search.page) || 1
    const per_page = parsePerPage(String(search.per_page ?? ''))
    const starred = String(search.starred ?? '')
    const github = String(search.github ?? '')
    return {
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(sort !== 'score' ? { sort } : {}),
      ...(order !== 'desc' ? { order } : {}),
      ...(page !== 1 ? { page } : {}),
      ...(search.per_page ? { per_page } : {}),
      ...(starred ? { starred } : {}),
      ...(github ? { github } : {}),
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listCandidatesFn({
      data: {
        q: deps.q || undefined,
        status: deps.status || undefined,
        sort: deps.sort,
        order: deps.order,
        page: deps.page,
        per_page: deps.per_page,
        starred_only: deps.starred === '1',
        has_github: deps.github === '1' ? true : deps.github === '0' ? false : undefined,
      },
    }),
  component: CandidatesPage,
})

function CandidatesPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Candidates</h1>
      <CandidatesToolbar />
      <CandidatesTable candidates={data.candidates} sort={search.sort ?? 'score'} order={search.order ?? 'desc'} />
      <CandidatesPagination
        page={data.page}
        perPage={data.per_page}
        total={data.total}
        totalPages={data.total_pages}
      />
    </div>
  )
}
