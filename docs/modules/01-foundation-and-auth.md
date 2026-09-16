# Auth & organizations

Auth is required. Unauthenticated users are redirected to `/login` (`src/server/route-auth.ts`).

## Files

| Path | Role |
|------|------|
| `src/lib/supabase/client.ts` | Browser client (`VITE_SUPABASE_*`) |
| `src/lib/supabase/server.ts` | Cookie SSR + service-role client |
| `src/routes/login.tsx` | Sign in |
| `src/routes/signup.tsx` | Sign up |
| `src/routes/auth/callback.tsx` | Email confirm / OAuth code exchange |
| `src/server/auth.ts` | Org context from session |
| `supabase/migrations/20260530100000_foundation.sql` | `profiles`, `organizations`, `organization_members`, RLS, signup trigger |

## Env

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Redirect: `http://localhost:3000/auth/callback`

Signup creates a profile and default org via `on_auth_user_created`.
