# Gmail OAuth

Per-user Gmail OAuth. Refresh tokens are encrypted with `TOKEN_ENCRYPTION_KEY` (AES-256, not Fernet).

## Tables

- `gmail_connections` — encrypted credentials per org/user
- `gmail_oauth_states` — CSRF state

## Env

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/gmail/callback
TOKEN_ENCRYPTION_KEY=
```

Production redirect: `https://your-app.vercel.app/api/gmail/callback`

## App paths

| Path | Role |
|------|------|
| `src/server/gmail-oauth.ts` | Connect / disconnect / Gmail client |
| `src/server/gmail-sync.ts` | Fetch + extract into Postgres/Storage |
| `src/routes/api/gmail/callback.tsx` | OAuth callback |
| `src/components/cloud-settings-panel.tsx` | Connect UI on `/settings` |
