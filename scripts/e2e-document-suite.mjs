#!/usr/bin/env node
/**
 * Run all document-generation E2E scenarios sequentially.
 * Usage: node scripts/e2e-document-suite.mjs [--base URL] [--only id1,id2] [--skip-browser]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { uploadFixture } from "./e2e-upload.mjs";
import { assertSessionDocuments } from "./e2e-assert-documents.mjs";
import { jaccardSimilarity } from "./e2e-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const scenariosPath = join(root, "tests", "e2e", "scenarios.json");
const fixturesDir = join(root, "tests", "fixtures", "scenarios");

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let only = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base" && args[i + 1]) baseUrl = args[++i];
    else if (args[i] === "--only" && args[i + 1]) only = args[++i].split(",");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), only };
}

async function startProcessing(baseUrl, recordingKey, sessionId) {
  const res = await fetch(`${baseUrl}/api/recordings/process`, {
    method: "POST",
    headers: {
      "x-recording-key": recordingKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Process start failed (${res.status})`);
  return body;
}

async function pollUntilDone(baseUrl, recordingKey, sessionId, scenarioId, maxMs = 300000) {
  const started = Date.now();
  const phasesSeen = new Set();
  let last = null;
  let tick = 0;

  while (Date.now() - started < maxMs) {
    const res = await fetch(
      `${baseUrl}/api/recordings/process?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: { "x-recording-key": recordingKey } }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Poll failed (${res.status})`);
    last = body;
    if (body.pipelinePhase) phasesSeen.add(body.pipelinePhase);

    const elapsed = Math.round((Date.now() - started) / 1000);
    if (tick === 0 || tick % 4 === 0 || body.status === "completed" || body.status === "failed") {
      console.log(
        JSON.stringify({
          step: "poll",
          scenario: scenarioId,
          t: elapsed,
          status: body.status,
          phase: body.pipelinePhase,
          stepNum: body.processingStep,
          observations: body.observationCount,
          objects: body.objectCount,
        })
      );
    }
    tick++;

    if (body.status === "completed") {
      return { ok: true, elapsedSec: elapsed, phasesSeen: [...phasesSeen], final: body };
    }
    if (body.status === "failed") {
      return { ok: false, error: body.errorMessage, phasesSeen: [...phasesSeen], final: body };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { ok: false, error: "Timeout after 5 min", phasesSeen: [...phasesSeen], final: last };
}

function checkCrossScenarioDifferentiation(results) {
  const errors = [];
  const texts = results
    .filter((r) => r.assertion?.documents?.length)
    .map((r) => ({
      id: r.scenarioId,
      text: r.assertion.documents.map((d) => d.text).join(" "),
    }));

  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const sim = jaccardSimilarity(texts[i].text, texts[j].text);
      if (sim > 0.8) {
        errors.push(
          `scenarios ${texts[i].id} vs ${texts[j].id}: token overlap ${(sim * 100).toFixed(0)}% (>80%)`
        );
      }
    }
  }
  return errors;
}

function renderRunlog(report) {
  const lines = [
    "# Document Generation E2E Run Log",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Recording key: \`${report.recordingKey}\``,
    "",
    "## Summary",
    "",
    `| Scenario | Status | Docs | documentType | Elapsed |`,
    `|----------|--------|------|--------------|---------|`,
  ];

  for (const r of report.results) {
    const types = (r.assertion?.documents ?? []).map((d) => d.documentType).join(", ") || "—";
    lines.push(
      `| ${r.scenarioId} | ${r.pass ? "PASS" : "FAIL"} | ${r.assertion?.documentCount ?? 0} | ${types} | ${r.poll?.elapsedSec ?? "—"}s |`
    );
  }

  if (report.crossScenarioErrors?.length) {
    lines.push("", "## Cross-scenario differentiation failures", "");
    for (const e of report.crossScenarioErrors) lines.push(`- ${e}`);
  }

  lines.push("", "## Per-scenario detail", "");
  for (const r of report.results) {
    lines.push(`### ${r.scenarioId}`, "");
    lines.push(`- Session: \`${r.sessionId}\``);
    lines.push(`- Phases: ${(r.poll?.phasesSeen ?? []).join(" → ")}`);
    if (r.assertion?.documents?.length) {
      for (const d of r.assertion.documents) {
        lines.push(`- Document \`${d.id}\`: **${d.title}** (${d.documentType}, ${d.blockCount} blocks)`);
      }
    }
    if (r.assertion?.errors?.length) {
      lines.push("- Errors:");
      for (const e of r.assertion.errors) lines.push(`  - ${e}`);
    }
    if (r.poll?.error) lines.push(`- Poll error: ${r.poll.error}`);
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const { baseUrl, only } = parseArgs();
  const scenarios = JSON.parse(readFileSync(scenariosPath, "utf8")).filter(
    (s) => !only || only.includes(s.id)
  );
  const recordingKey = `rk_doc_e2e_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const results = [];

  console.log(JSON.stringify({ step: "suite_start", recordingKey, count: scenarios.length }));

  for (const scenario of scenarios) {
    const fixturePath = join(fixturesDir, scenario.fixture);
    console.log(JSON.stringify({ step: "scenario_start", id: scenario.id }));

    let upload;
    try {
      upload = await uploadFixture({
        recordingKey,
        baseUrl,
        fixturePath,
        durationSeconds: scenario.durationSeconds ?? 25,
        sessionIdPrefix: `rec-doc-${scenario.id.slice(0, 8)}`,
      });
    } catch (err) {
      results.push({
        scenarioId: scenario.id,
        pass: false,
        error: err.message,
      });
      continue;
    }

    try {
      await startProcessing(baseUrl, recordingKey, upload.sessionId);
    } catch (err) {
      results.push({
        scenarioId: scenario.id,
        sessionId: upload.sessionId,
        pass: false,
        error: err.message,
      });
      continue;
    }

    const poll = await pollUntilDone(baseUrl, recordingKey, upload.sessionId, scenario.id);
    let assertion = null;
    if (poll.ok) {
      assertion = await assertSessionDocuments({
        recordingKey,
        sessionId: upload.sessionId,
        scenario,
        baseUrl,
      });
    }

    const pass = poll.ok && assertion?.ok;
    results.push({
      scenarioId: scenario.id,
      sessionId: upload.sessionId,
      poll,
      assertion,
      pass,
      documentIds: (assertion?.documents ?? []).map((d) => d.id),
    });

    console.log(
      JSON.stringify({
        step: "scenario_done",
        id: scenario.id,
        pass,
        sessionId: upload.sessionId,
        documentIds: (assertion?.documents ?? []).map((d) => d.id),
      })
    );
  }

  const crossScenarioErrors = checkCrossScenarioDifferentiation(results);
  const report = {
    recordingKey,
    results,
    crossScenarioErrors,
    allPass:
      results.every((r) => r.pass) && crossScenarioErrors.length === 0,
  };

  mkdirSync(join(root, "tests", "e2e"), { recursive: true });
  writeFileSync(join(root, "tests", "e2e", "DOC-RUNLOG.md"), renderRunlog(report));
  writeFileSync(
    join(root, "tests", "e2e", "last-suite-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify({ step: "suite_done", allPass: report.allPass }, null, 2));
  process.exit(report.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
