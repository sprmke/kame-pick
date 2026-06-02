-- Phase 3: candidates + file metadata + sync state + storage bucket

-- ---------------------------------------------------------------------------
-- Candidates (replaces manifest.json + per-candidate metadata)
-- ---------------------------------------------------------------------------

CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ,
  github_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  primary_pdf TEXT,
  pdf_label TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  links JSONB NOT NULL DEFAULT '{"all":[],"github":[],"linkedin":[],"portfolio_and_other":[]}'::jsonb,
  email_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX idx_candidates_org_received ON public.candidates (organization_id, received_at DESC);
CREATE INDEX idx_candidates_org_slug ON public.candidates (organization_id, slug);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidates_member"
  ON public.candidates FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Candidate files (attachments + extracted text metadata)
-- ---------------------------------------------------------------------------

CREATE TABLE public.candidate_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  candidate_slug TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('attachment', 'extracted', 'other')),
  filename TEXT NOT NULL,
  storage_path TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  content_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, candidate_slug)
    REFERENCES public.candidates (organization_id, slug) ON DELETE CASCADE
);

CREATE INDEX idx_candidate_files_slug
  ON public.candidate_files (organization_id, candidate_slug, kind);

ALTER TABLE public.candidate_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_files_member"
  ON public.candidate_files FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Gmail sync state (per org)
-- ---------------------------------------------------------------------------

CREATE TABLE public.sync_state (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  processed_message_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_run_at TIMESTAMPTZ
);

ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_state_member"
  ON public.sync_state FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for PDF attachments
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-files',
  'candidate-files',
  false,
  52428800,
  ARRAY['application/pdf', 'text/plain', 'message/rfc822']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "candidate_files_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'candidate-files'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "candidate_files_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-files'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "candidate_files_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'candidate-files'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "candidate_files_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'candidate-files'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_state TO authenticated;
