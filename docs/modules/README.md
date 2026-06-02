# Module documentation

Each feature area has its own doc, updated when that module is implemented or changed.

| # | Module | Status | Doc |
|---|--------|--------|-----|
| 01 | Foundation & auth | Code complete | [01-foundation-and-auth.md](./01-foundation-and-auth.md) |
| 02 | Database schema (cloud) | Code complete | [02-database-schema.md](./02-database-schema.md) |
| 03 | Candidates (cloud storage) | Code complete | [03-candidates-cloud.md](./03-candidates-cloud.md) |
| 04 | Gmail (web OAuth) | Code complete | [04-gmail-oauth.md](./04-gmail-oauth.md) |
| 05 | Production deploy | Docs complete | [production-deployment.md](../production-deployment.md) |

## Doc template

When adding a module doc, include:

1. **Purpose** — what problem it solves
2. **Scope** — files, tables, env vars
3. **Local vs cloud** — which code path is used when
4. **Setup** — how to configure and test
5. **API / schema** — endpoints or SQL reference
6. **Changelog** — dated entries per work session
