import {
  bigint,
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const orgMemberRole = pgEnum('org_member_role', ['owner', 'admin', 'member'])

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: orgMemberRole('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobCriteria = pgTable('job_criteria', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    email: text('email').notNull().default(''),
    name: text('name').notNull().default(''),
    subject: text('subject').notNull().default(''),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    githubUrls: jsonb('github_urls').$type<string[]>().notNull().default([]),
    attachmentCount: bigint('attachment_count', { mode: 'number' }).notNull().default(0),
    primaryPdf: text('primary_pdf'),
    pdfLabel: text('pdf_label'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    links: jsonb('links')
      .$type<{
        all: string[]
        github: string[]
        linkedin: string[]
        portfolio_and_other: string[]
      }>()
      .notNull()
      .default({ all: [], github: [], linkedin: [], portfolio_and_other: [] }),
    emailText: text('email_text').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.organizationId, t.slug)],
)

export const candidateNotes = pgTable(
  'candidate_notes',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    status: text('status').notNull().default('new'),
    starred: boolean('starred').notNull().default(false),
    notes: text('notes').notNull().default(''),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.slug] }),
  }),
)

export const candidateFiles = pgTable('candidate_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  candidateSlug: text('candidate_slug').notNull(),
  kind: text('kind').notNull(),
  filename: text('filename').notNull(),
  storagePath: text('storage_path'),
  mimeType: text('mime_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  contentText: text('content_text'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const analysisRuns = pgTable('analysis_runs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  filterJson: jsonb('filter_json').notNull().default({}),
  resultsJson: jsonb('results_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const syncJobs = pgTable('sync_jobs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  jobType: text('job_type').notNull(),
  status: text('status').notNull(),
  message: text('message').notNull().default(''),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const githubCache = pgTable('github_cache', {
  username: text('username').primaryKey(),
  publicRepos: bigint('public_repos', { mode: 'number' }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  error: text('error'),
  profileJson: jsonb('profile_json'),
})

export const emailMessages = pgTable('email_messages', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  analysisRunId: bigint('analysis_run_id', { mode: 'number' }),
  gmailMessageId: text('gmail_message_id'),
  gmailThreadId: text('gmail_thread_id'),
  direction: text('direction').notNull(),
  fromEmail: text('from_email').notNull().default(''),
  toEmail: text('to_email').notNull().default(''),
  subject: text('subject').notNull(),
  bodyText: text('body_text').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('sent'),
  error: text('error'),
})

export const gmailConnections = pgTable(
  'gmail_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    emailAddress: text('email_address').notNull().default(''),
    credentialsEncrypted: text('credentials_encrypted').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.organizationId, t.userId)],
)

export const gmailOauthStates = pgTable('gmail_oauth_states', {
  state: text('state').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const syncState = pgTable('sync_state', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  processedMessageIds: jsonb('processed_message_ids').notNull().default([]),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
})
