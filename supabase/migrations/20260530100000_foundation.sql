-- Foundation schema: profiles, organizations, members, RLS
-- Apply via Supabase SQL Editor or: supabase db push

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin', 'member');

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select_member"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "organizations_update_owner_admin"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Organization members
-- ---------------------------------------------------------------------------

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.org_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_organization_members_user ON public.organization_members (user_id);
CREATE INDEX idx_organization_members_org ON public.organization_members (organization_id);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_same_org"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members AS om
      WHERE om.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "org_members_insert_owner_admin"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members AS om
      WHERE om.user_id = (SELECT auth.uid()) AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_members_update_owner_admin"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members AS om
      WHERE om.user_id = (SELECT auth.uid()) AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members AS om
      WHERE om.user_id = (SELECT auth.uid()) AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_members_delete_owner_admin"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members AS om
      WHERE om.user_id = (SELECT auth.uid()) AND om.role IN ('owner', 'admin')
    )
  );

-- Allow new signups to insert themselves as owner (bootstrap membership)
CREATE POLICY "org_members_insert_self_owner"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND role = 'owner'
  );

-- Allow org creation by authenticated users (signup bootstrap)
CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.slugify_org_name(raw_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate_slug TEXT;
  suffix INT := 0;
BEGIN
  base_slug := lower(regexp_replace(trim(raw_name), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'workspace';
  END IF;
  candidate_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = candidate_slug) LOOP
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::TEXT;
  END LOOP;
  RETURN candidate_slug;
END;
$$;

-- Bootstrap profile + default organization on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_name TEXT;
  org_slug TEXT;
  new_org_id UUID;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  );

  org_name := COALESCE(
    NEW.raw_user_meta_data ->> 'organization_name',
    split_part(NEW.email, '@', 1) || '''s workspace'
  );
  org_slug := public.slugify_org_name(org_name);

  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant API access (Supabase Data API)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
