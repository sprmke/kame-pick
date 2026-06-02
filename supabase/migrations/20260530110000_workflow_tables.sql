-- Phase 2: workflow state tables (mirrors SQLite, scoped by organization)

-- ---------------------------------------------------------------------------
-- Job criteria (per org, replaces config/job-criteria.yaml in cloud mode)
-- ---------------------------------------------------------------------------

CREATE TABLE public.job_criteria (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_criteria_select_member"
  ON public.job_criteria FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "job_criteria_insert_admin"
  ON public.job_criteria FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "job_criteria_update_admin"
  ON public.job_criteria FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Candidate notes
-- ---------------------------------------------------------------------------

CREATE TABLE public.candidate_notes (
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  starred BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, slug)
);

CREATE INDEX idx_candidate_notes_org_status
  ON public.candidate_notes (organization_id, status);

ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_notes_member"
  ON public.candidate_notes FOR ALL TO authenticated
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
-- Analysis runs
-- ---------------------------------------------------------------------------

CREATE TABLE public.analysis_runs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  results_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_runs_org ON public.analysis_runs (organization_id, id DESC);

ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_runs_member"
  ON public.analysis_runs FOR ALL TO authenticated
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
-- Sync jobs
-- ---------------------------------------------------------------------------

CREATE TABLE public.sync_jobs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_jobs_org_type ON public.sync_jobs (organization_id, job_type, id DESC);

ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_jobs_member"
  ON public.sync_jobs FOR ALL TO authenticated
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
-- GitHub cache (global — not tenant-specific)
-- ---------------------------------------------------------------------------

CREATE TABLE public.github_cache (
  username TEXT PRIMARY KEY,
  public_repos INTEGER,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error TEXT,
  profile_json JSONB
);

ALTER TABLE public.github_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "github_cache_read_authenticated"
  ON public.github_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "github_cache_write_authenticated"
  ON public.github_cache FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "github_cache_update_authenticated"
  ON public.github_cache FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Email messages
-- ---------------------------------------------------------------------------

CREATE TABLE public.email_messages (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  analysis_run_id BIGINT REFERENCES public.analysis_runs (id) ON DELETE SET NULL,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  direction TEXT NOT NULL,
  from_email TEXT NOT NULL DEFAULT '',
  to_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT
);

CREATE INDEX idx_email_messages_slug ON public.email_messages (organization_id, slug);
CREATE INDEX idx_email_messages_run ON public.email_messages (organization_id, analysis_run_id);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_messages_member"
  ON public.email_messages FOR ALL TO authenticated
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

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_criteria TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_messages TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
