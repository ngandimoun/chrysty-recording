# E2E Pipeline Run Log

Date: 2026-06-28

## Preflight

| Check | Result |
|-------|--------|
| Dev server `http://localhost:3000` | 200 OK |
| `ffmpeg-static` | Present |
| `.env.local` | Supabase + Gemini configured |
| Unit tests | 45 passed |
| Typecheck | Clean |

## Fixture

- `tests/fixtures/sample-speech.webm` — 120 KB, ~15s TTS (Alex Chen / Sarah / Q3 budget / preferences / reminder)
- Helper scripts: `scripts/e2e-upload.mjs`, `scripts/e2e-poll.mjs`

---

## Run 1 — Browser E2E (primary)

| Field | Value |
|-------|-------|
| Recording key | `rk_af503e7e2cb04fc7af23b7c5881fa84a` |
| Session ID | `rec-e2e-1782659078531` |
| Elapsed (processing UI) | ~2m 30s to materializing; full completion ~3m |

### Pipeline phases observed (poll + UI)

1. `transcribing` — UI: "Transcribing / Reading your voice…"
2. `observing` — UI: "Observing / Observing what matters…" (+ long-wait hint at 50s)
3. `scoring` — sub-message: "Scoring significance…"
4. `planning` — sub-message: "Planning next steps…"
5. `materializing` — UI: "Updating knowledge / Materializing knowledge…" + **8 observations captured**
6. `finishing` — redirect to results

### Results verification

| Check | Result |
|-------|--------|
| URL | `/results/rec-e2e-1782659078531` |
| Subtitle | "What we learned" |
| Analyst summary | Present |
| Observations | 8 with badges (Important, New, Reminder, Preference) |
| Artifacts | 8 knowledge objects |
| Enrichment banner | "Still indexing for search…" (then `done`) |
| API counts | observations=8, objects=8, status=completed |

### DB verification (Supabase)

- `recording_sessions.status` = `completed`
- `pipeline_state.phase` = `finishing`
- `pipeline_state.observationCount` = 8, `objectCount` = 8
- `recording_observations` rows = 8
- `enrichment_status` = `done`

---

## Run 2 — Re-run after silent-failure fixes

| Field | Value |
|-------|--------|
| Recording key | `rk_e2e_rerun_001` |
| Session ID | `rec-e2e-1782659479569` |
| Elapsed (API poll) | 146s |

### Phases seen (API poll)

`observing` → `scoring` → `planning` → `materializing` → `finishing`

| t (s) | phase | observations | objects |
|-------|-------|--------------|---------|
| 19 | scoring | 7 | 0 |
| 25 | planning | 7 | 0 |
| 41 | materializing | 7 | 0 |
| 48 | materializing | 7 | 2 |
| 57 | materializing | 7 | 3 |
| 102 | materializing | 7 | 5 |
| 146 | finishing | 7 | 5 (completed) |

Browser auto-redirected to `/results/rec-e2e-1782659479569` with observations + session summary.

---

## Fixes applied (silent failures)

| Issue | Fix |
|-------|-----|
| Poll errors swallowed | `pollProcessingStatus` parses API error body; processing page shows warning after 3 consecutive failures |
| 4-min false error screen | 240s timeout now shows non-blocking hint; animation continues |
| Banner restart silent | `ProcessingBanner` toasts on `processRecording` failure |
| Observations fetch → fake empty | Results page shows explicit error banner instead of empty panel |
| Enrichment failure invisible | Results page shows banner when `enrichmentStatus === 'failed'` |
| GET process catch → 404 | Unexpected errors return 500 |

---

## Manual checklist (passed)

- [x] Upload returns 200 with valid sessionId
- [x] Processing advances through all sub-phases
- [x] Live observation count appears during step 1–2
- [x] Results show observations first with badges
- [x] Completion toast shows counts
- [x] No 4xx/5xx on core routes during happy path
- [x] DB row consistent with UI

## How to re-run

```bash
node scripts/e2e-upload.mjs
# Note recordingKey + sessionId, seed browser storage, open /processing
# Or poll from CLI:
node scripts/e2e-poll.mjs --key rk_... --session rec-e2e-...
```
