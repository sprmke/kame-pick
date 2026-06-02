-- OAuth state table for Gmail web flow (short-lived)

CREATE TABLE public.gmail_oauth_states (
  state TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gmail_oauth_states_created ON public.gmail_oauth_states (created_at);

-- Auto-expire states older than 1 hour (optional cleanup via cron)
ALTER TABLE public.gmail_oauth_states ENABLE ROW LEVEL SECURITY;

-- Server uses service role / direct postgres — no client policies needed for states
GRANT SELECT, INSERT, DELETE ON public.gmail_oauth_states TO authenticated;
