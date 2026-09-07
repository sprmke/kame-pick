import { useNavigate, useSearch } from '@tanstack/react-router'

export function useCandidatesSearch() {
  return useSearch({ strict: false }) as Record<string, string | undefined>
}

export function useCandidatesNavigate() {
  const navigate = useNavigate()
  const search = useCandidatesSearch()

  return (patch: Record<string, string | undefined>) => {
    const next = { ...search, ...patch }
    if (!patch.page) next.page = undefined
    Object.keys(next).forEach((k) => {
      if (next[k] === '' || next[k] === undefined) delete next[k]
    })
    navigate({ to: '/candidates', search: next as never })
  }
}
