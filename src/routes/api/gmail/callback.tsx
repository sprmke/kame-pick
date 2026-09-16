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
        } catch (err) {
          settingsUrl.searchParams.set('gmail', 'error')
          const raw = err instanceof Error ? err.message : 'Gmail connection failed'
          const friendly = raw.includes('malformed array literal')
            ? 'Could not save Gmail connection — retry Connect Gmail'
            : raw.includes('Token exchange failed')
              ? 'Google rejected the OAuth token — check redirect URI in Google Cloud Console'
              : raw.slice(0, 180)
          settingsUrl.searchParams.set('gmail_error', friendly)
          console.error('[gmail/callback]', err)
        }

        return Response.redirect(settingsUrl)
      },
    },
  },
})
