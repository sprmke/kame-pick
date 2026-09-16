# Migration history

The app is a **single TanStack Start + Supabase** codebase. The archived Next.js + FastAPI stack (`old-app/`) has been removed.

Historical phases (all complete):

1. Auth, organizations, RLS
2. Workflow tables in Postgres
3. Candidates + Storage
4. Gmail OAuth
5. Vercel deploy docs
6. Remove the dual-mode local/cloud stack

Current setup: [architecture.md](./architecture.md) · [local-development.md](./local-development.md) · [production-deployment.md](./production-deployment.md)
