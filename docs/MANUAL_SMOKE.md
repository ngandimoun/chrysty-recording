# Manual device smoke checklist

Cross-browser recording and locale-aware generation cannot be fully automated in CI (real microphone required). Run this matrix after deploy or before release.

## Prerequisites

- HTTPS or `localhost` (required for `getUserMedia`)
- Valid recording key in browser storage
- Supabase migration `recording_worker_session_locale` applied (or `pipeline_state` fallbacks active)

## Test matrix

| Device | Browser | Steps | Pass criteria |
|--------|---------|-------|---------------|
| iPhone | Safari | Open app → tap **Start** on recording page → speak 30s → Finish | Upload succeeds; session reaches `completed`; objects appear |
| iPad | Safari | Same as iPhone; rotate to landscape | Layout usable; same pass criteria |
| Android phone | Chrome | Record from home → Finish | WebM upload; processing completes |
| macOS | Safari | Record 30s | MP4/M4A path stored (`audio.m4a` or `audio.mp4`); processing completes |
| Desktop | Chrome | Record 30s | WebM regression: `audio.webm`; processing completes |
| Desktop | Firefox | Record 30s | Supported MIME uploads; processing completes |

## Recording UX checks

- [ ] Recording page does **not** auto-start mic on load (iOS gesture)
- [ ] Pause hidden on Safari when pause/resume unsupported
- [ ] Clear error if HTTP (non-secure context) or mic denied
- [ ] Empty recording rejected before upload

## Locale / date checks

Record in **English** with phrase: *"Remind me tomorrow at 9am to call Alex."*

- [ ] Attention item `dueAt` is next calendar day 09:00 in browser timezone (ISO with offset)
- [ ] Subtitle echoes user phrasing where applicable

Record in **French** with phrase: *"Demain à 9h, rappelle-moi d'appeler Marie."*

- [ ] Knowledge object titles/subtitles in French
- [ ] `dueAt` resolves relative to recording date in client timezone
- [ ] Insights Q&A answers in French when workspace language is French

## Today section

- [ ] Home "Today" shows only pending attention items due today or overdue (client timezone)
- [ ] Due dates display via formatted `dueAt`, not raw ISO

## Failure notes

| Symptom | Likely cause |
|---------|----------------|
| Upload 400 empty file | Safari chunk flush / zero-length blob |
| Processing fails on Safari | Wrong extension (`.webm` for MP4 bytes) — verify `audio.{ext}` path |
| English titles from French audio | Transcription language tags missing; check `primary_language` on session |
| Wrong "tomorrow" date | Missing `client_timezone`; verify upload form field |

## Sign-off

| Date | Tester | Devices passed | Notes |
|------|--------|----------------|-------|
| | | | |
