# Module 04 — Gmail OAuth (web)

**Status:** Code complete  
**Phase:** 4

## Purpose

Per-user Gmail OAuth for cloud mode — replaces desktop `token.json` flow.

## Tables

- `gmail_connections` — encrypted refresh tokens per org/user
- `gmail_oauth_states` — CSRF state for OAuth redirect

## Env vars (API)

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://api.example.com/api/gmail/oauth/callback
TOKEN_ENCRYPTION_KEY=   # Fernet key
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gmail/connect-url` | Returns Google authorize URL |
| GET | `/api/gmail/oauth/callback` | OAuth redirect handler |
| DELETE | `/api/gmail/disconnect` | Remove stored tokens |
| GET | `/api/gmail/status` | Send readiness (uses cloud tokens when authenticated) |

## UI

Settings page (`/settings`) — Connect / Disconnect Gmail, import local data.

## Sync

`server/cloud/gmail_sync.py` — fetch emails into Postgres + Storage, extract PDFs.

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | OAuth flow, encrypted tokens, cloud sync, settings UI |
