const colors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  reviewing: 'bg-amber-100 text-amber-800',
  shortlisted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  contacted: 'bg-purple-100 text-purple-800',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] ?? 'bg-zinc-100 text-zinc-700'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}
