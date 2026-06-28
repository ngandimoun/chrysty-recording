# Document Generation E2E Run Log

Date: 2026-06-28

## Why it looked stuck

The suite was **not frozen**. Each scenario runs the full Gemini pipeline (transcribe → observe → score → plan → materialize → presentation engine), which takes **~2.5–4 minutes per scenario**. Running all 6 back-to-back is **~15–20 minutes total**.

Earlier runs appeared stuck because:
1. The poll loop was **silent** (no output for minutes between `scenario_start` and `scenario_done`)
2. A 5-scenario batch was **interrupted** after ~15 minutes before it finished

**Fix applied:** `e2e-document-suite.mjs` now prints live poll progress every ~6 seconds (`step: poll`, phase, elapsed time).

---

## Final results (all 6 scenarios)

| Scenario | Status | Primary document | documentType | Blocks | Session |
|----------|--------|------------------|--------------|--------|---------|
| construction-inspection | **PASS** | Site Inspection Report: 123 Main Street | inspection | 5 | `rec-doc-construc-1782661954514` |
| medical-consult | **PASS** | Patient Consultation Notes: Jane Doe | medical | multi | `rec-doc-medical--1782663161919` |
| legal-compliance | **PASS** | Legal Compliance Memo: Data Retention Breach | legal | multi | `rec-doc-legal-co-1782664274605` |
| sales-email | **PASS** | Go-Live Extension Request Plan | generic | 5 | `rec-doc-sales-em-1782663534582` |
| agriculture-field-report | **PASS** | Field Operations Report: Cornfield Block 7 | inspection | 5 | `rec-doc-agricult-1782663777804` |
| hospitality-ops-report | **PASS** | Restaurant Operations Report | inspection | 5 | `rec-doc-hospital-1782664024562` |

Cross-industry differentiation confirmed: construction (roof/contractor), medical (patient/blood pressure), legal (contract/compliance), sales (client/email/delay), agriculture (corn/irrigation/yield), hospitality (restaurant/kitchen/staffing).

---

## Bugs found and fixed during E2E

| Issue | Fix |
|-------|-----|
| Presentation docs saved as 1-block JSON blob | `coerceGeminiDocument()` normalizes Gemini checklist/timeline/decisions shapes before Zod parse |
| Suite appeared stuck | Live poll logging in `e2e-document-suite.mjs` |
| Legal assertion picked wrong primary doc | Primary doc = highest block count among matching `documentType` |

---

## How to run (with visible progress)

```bash
# Single scenario (~3 min)
node scripts/e2e-document-suite.mjs --only medical-consult

# All 6 scenarios (~18 min, prints poll progress)
node scripts/e2e-document-suite.mjs

# Watch log file
Get-Content tests/e2e/suite-progress.log -Wait
```

Browser check: open `/library/{documentId}` for any primary doc ID above.
