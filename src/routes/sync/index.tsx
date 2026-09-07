import { createFileRoute } from '@tanstack/react-router'
import { SyncPanel } from '#/components/sync-panel'
import { syncStatusFn } from '#/server/functions'

export const Route = createFileRoute('/sync/')({
  loader: () => syncStatusFn(),
  component: SyncPage,
})

function SyncPage() {
  const initialStatus = Route.useLoaderData()
  return (
    <div className="p-8">
      <h1 className="mb-2 text-3xl font-bold">Gmail Sync</h1>
      <p className="mb-6 text-zinc-500">Fetch applicant emails and extract resume PDFs into your workspace.</p>
      <SyncPanel initialStatus={initialStatus} />
    </div>
  )
}
