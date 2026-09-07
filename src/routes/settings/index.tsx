'use client'

import { createFileRoute } from '@tanstack/react-router'
import { JobCriteriaEditor } from '#/components/job-criteria-editor'
import { CloudSettingsPanel } from '#/components/cloud-settings-panel'
import { getJobCriteriaFn } from '#/server/functions'

export const Route = createFileRoute('/settings/')({
  loader: () => getJobCriteriaFn(),
  component: SettingsPage,
})

function SettingsPage() {
  const criteria = Route.useLoaderData()
  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>
      <div className="space-y-6">
        <CloudSettingsPanel />
        <JobCriteriaEditor
          initialContent={criteria.raw}
          path="config/job-criteria.yaml"
        />
      </div>
    </div>
  )
}
