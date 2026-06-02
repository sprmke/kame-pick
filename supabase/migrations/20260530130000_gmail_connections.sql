-- Phase 4: per-user Gmail OAuth connections

CREATE TABLE public.gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email_address TEXT NOT NULL DEFAULT '',
  credentials_encrypted TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_gmail_connections_org ON public.gmail_connections (organization_id);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gmail_connections_select_own"
  ON public.gmail_connections FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "gmail_connections_insert_own"
  ON public.gmail_connections FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "gmail_connections_update_own"
  ON public.gmail_connections FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "gmail_connections_delete_own"
  ON public.gmail_connections FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TRIGGER gmail_connections_updated_at
  BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_connections TO authenticated;
