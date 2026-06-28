# Chrysty Recording worker

Worker template for [chrysty.dev](https://chrysty.dev). Shares the **chrysty** Supabase project (`uusnstujtczqjorfqgdn`) with isolated recording tables, storage bucket, and platform slug `recording`.

## Supabase MCP workflow (required)

Before any database change:

1. **`list_projects`** — confirm target is **chrysty** (`uusnstujtczqjorfqgdn`)
2. **`list_migrations`** — check what is already applied; never duplicate
3. **`list_tables`** — verify current schema
4. **Write SQL locally** under `supabase/migrations/` first
5. **Stop and ask the user** before applying DDL to production
6. **`apply_migration`** — only after explicit user approval (`name`: snake_case, e.g. `recording_worker_register`)
7. **`generate_typescript_types`** — refresh `lib/supabase/database.types.ts` after apply
8. **`get_advisors`** — report RLS/security findings; do not enable RLS without policies

**Never** call `apply_migration` during feature work unless the user explicitly says to apply.

## Remote migration history (baseline)

Already applied on chrysty (do not re-run):

| Remote name | Local reference |
|---|---|
| `chrysty_recording_schema` | `20260628000000_recording_worker_schema_baseline.sql` |
| `session_attachments` | `20260628100000_session_attachments_baseline.sql` |
| `recording_worker_session_locale` | `20260628140000_recording_worker_session_locale.sql` |
| `recording_worker_presentation_document` | `20260628150000_recording_worker_presentation_document.sql` |
| `recording_worker_observations` | `20260628160000_recording_worker_observations.sql` |

Forward migrations use `recording_worker_*` naming.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the observation-first pipeline philosophy.

## Platform

- Worker slug: `recording` (`NEXT_PUBLIC_WORKER_SLUG`)
- Platform API: `https://api.chrysty.dev`
- Auth guard: `lib/chrysty/guard.ts` — use on upload, process, and insights routes
- Workspace key header: `x-recording-key`

## Storage

- Bucket: `recording-uploads` (`SUPABASE_UPLOADS_BUCKET`)
- Path: `{recording_key}/{session_id}/audio.{ext}` (e.g. `.webm`, `.m4a`, `.mp4`) and `{recording_key}/{session_id}/context/{attachment_id}`
