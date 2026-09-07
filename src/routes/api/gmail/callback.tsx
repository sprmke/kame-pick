import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/gmail/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const settingsUrl = new URL('/settings', url.origin)

        if (!code || !state) {
          settingsUrl.searchParams.set('gmail', 'error')
          return Response.redirect(settingsUrl)
        }

        try {
          const { exchangeCode } = await import('#/server/gmail-oauth')
          await exchangeCode(code, state)
          settingsUrl.searchParams.set('gmail', 'connected')
        } catch {
          settingsUrl.searchParams.set('gmail', 'error')
        }

        return Response.redirect(settingsUrl)
      },
    },
  },
})
