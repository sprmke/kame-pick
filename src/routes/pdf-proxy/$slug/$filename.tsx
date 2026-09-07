import { createFileRoute } from '@tanstack/react-router'
import { requireOrgContext } from '#/server/auth'
import { getAttachmentBytes } from '#/server/storage'

export const Route = createFileRoute('/pdf-proxy/$slug/$filename')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const ctx = await requireOrgContext()
        const result = await getAttachmentBytes(ctx.organizationId, params.slug, params.filename)
        if (!result) return new Response('Not found', { status: 404 })
        return new Response(result.bytes, {
          headers: {
            'Content-Type': result.mimeType,
            'Content-Disposition': `inline; filename="${result.filename}"`,
          },
        })
      },
    },
  },
})
