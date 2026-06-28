# Recording worker migrations

All migrations target the shared **chrysty** Supabase project (`uusnstujtczqjorfqgdn`).

## Already applied remotely

| Version (remote) | Name | Local baseline file |
|---|---|---|
| `20260628000251` | `chrysty_recording_schema` | `20260628000000_recording_worker_schema_baseline.sql` |
| `20260628002136` | `session_attachments` | `20260628100000_session_attachments_baseline.sql` |

Do **not** re-apply baseline files. Use forward migrations below.

## Forward migrations (apply via Supabase MCP after user approval)

| Local file | MCP `name` |
|---|---|
| `20260628120000_recording_worker_register.sql` | `recording_worker_register` |
| `20260628120100_recording_workspaces.sql` | `recording_workspaces` |
| `20260628120200_recording_worker_rls.sql` | `recording_worker_rls` |
| `20260628120300_recording_worker_storage.sql` | `recording_worker_storage` |
