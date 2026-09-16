# Candidates & Storage

Candidates live in Postgres. PDFs are in Supabase Storage.

## Tables

- `candidates` — manifest fields + metadata / links / email text
- `candidate_files` — attachment paths + extracted text
- `sync_state` — processed Gmail message IDs

## Storage

Bucket: `candidate-files`  
Path: `{organization_id}/{slug}/attachments/{filename}`

## App paths

| Path | Role |
|------|------|
| `src/server/candidates.ts` | List / get / notes / criteria |
| `src/server/storage.ts` | Upload + download |
| `src/routes/pdf-proxy/$slug/$filename.tsx` | Authenticated PDF proxy |
| `scripts/migrate-local-data.ts` | Optional one-time import from `./data` |

Run `bun run migrate:local` if you have a leftover filesystem `data/` folder.
