# Job Applicants Analyzer — App Documentation

Documentation for the **cloud full-stack** migration. The original local workflow (Gmail scripts, `data/candidates/`, SQLite) remains supported and is **not removed** during this work.

## Quick links

| Doc | Description |
|-----|-------------|
| [Architecture](./architecture.md) | Target system design (local + cloud) |
| [Migration roadmap](./migration-roadmap.md) | Phased plan and module status |
| [Local development](./local-development.md) | Run the existing local app unchanged |
| [Production deployment](./production-deployment.md) | Deploy web + API to production |
| [Modules](./modules/README.md) | Per-feature docs (updated as we ship) |

## Operating modes

| Mode | When | Auth | Data |
|------|------|------|------|
| **Local** (default) | Supabase env vars unset | None | Filesystem + SQLite |
| **Cloud** | Supabase configured | Supabase Auth | Postgres + Storage (phased) |

Both modes share the same Next.js UI and FastAPI backend. Cloud features are added incrementally without deleting local code paths.

## Updating docs

When implementing a module:

1. Add or update `docs/modules/XX-<name>.md`
2. Mark status in [modules/README.md](./modules/README.md)
3. Update [migration-roadmap.md](./migration-roadmap.md) checklist if a phase item is done
