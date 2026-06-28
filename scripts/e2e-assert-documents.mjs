#!/usr/bin/env node
/**
 * Assert generated documents for a session against scenario expectations.
 * Usage: node scripts/e2e-assert-documents.mjs --key rk_... --session rec-... [--scenario-id construction-inspection]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkKeywords,
  extractDocumentText,
  validatePresentationDocument,
} from "./e2e-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const scenariosPath = join(root, "tests", "e2e", "scenarios.json");

function parseArgs() {
  const args = process.argv.slice(2);
  let recordingKey = null;
  let sessionId = null;
  let scenarioId = null;
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key" && args[i + 1]) recordingKey = args[++i];
    else if (args[i] === "--session" && args[i + 1]) sessionId = args[++i];
    else if (args[i] === "--scenario-id" && args[i + 1]) scenarioId = args[++i];
    else if (args[i] === "--base" && args[i + 1]) baseUrl = args[++i];
  }
  if (!recordingKey || !sessionId) {
    console.error(
      "Usage: node scripts/e2e-assert-documents.mjs --key rk_... --session rec-... [--scenario-id id]"
    );
    process.exit(1);
  }
  return { recordingKey, sessionId, scenarioId, baseUrl: baseUrl.replace(/\/$/, "") };
}

async function fetchJson(url, recordingKey) {
  const res = await fetch(url, { headers: { "x-recording-key": recordingKey } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export async function assertSessionDocuments({
  recordingKey,
  sessionId,
  scenario,
  baseUrl = "http://localhost:3000",
}) {
  const [objectsRes, sessionRes] = await Promise.all([
    fetchJson(
      `${baseUrl}/api/knowledge-objects?sessionId=${encodeURIComponent(sessionId)}`,
      recordingKey
    ),
    fetchJson(
      `${baseUrl}/api/recordings/session?sessionId=${encodeURIComponent(sessionId)}`,
      recordingKey
    ),
  ]);

  const objects = objectsRes.objects ?? [];
  const documents = objects.filter((o) => o.type === "document");
  const errors = [];
  const warnings = [];

  if (documents.length === 0) {
    errors.push("no type=document knowledge objects");
  }

  const docResults = [];
  for (const doc of documents) {
    const pres = doc.presentationDocument;
    const validation = validatePresentationDocument(pres);
    const text = extractDocumentText(pres) + " " + (doc.previewContent ?? "") + " " + doc.title;
    docResults.push({
      id: doc.id,
      title: doc.title,
      documentType: pres?.documentType,
      blockCount: pres?.blocks?.length ?? 0,
      validation,
      text,
    });
  }

  const primaryDoc =
    docResults
      .filter((d) =>
        scenario?.expectedDocumentType
          ? d.documentType === scenario.expectedDocumentType
          : true
      )
      .reduce(
        (best, d) => (d.blockCount > (best?.blockCount ?? 0) ? d : best),
        undefined
      ) ?? docResults.reduce(
      (best, d) => (d.blockCount > (best?.blockCount ?? 0) ? d : best),
      docResults[0]
    );

  if (primaryDoc && !primaryDoc.validation.ok) {
    errors.push(`primary doc ${primaryDoc.id}: ${primaryDoc.validation.errors.join(", ")}`);
  }

  if (scenario) {
    const combinedText = docResults.map((d) => d.text).join(" ");
    const kw = checkKeywords(
      combinedText,
      scenario.requiredKeywords,
      scenario.forbiddenKeywords
    );
    if (!kw.ok) {
      if (kw.missing.length) errors.push(`missing keywords: ${kw.missing.join(", ")}`);
      if (kw.forbidden.length) errors.push(`forbidden keywords: ${kw.forbidden.join(", ")}`);
    }

    if (scenario.expectedDocumentType && !scenario.softDocumentType && primaryDoc) {
      if (primaryDoc.documentType !== scenario.expectedDocumentType) {
        errors.push(
          `expected documentType ${scenario.expectedDocumentType}, got ${primaryDoc.documentType}`
        );
      }
    }

    if (scenario.artifactKind === "email" && primaryDoc) {
      const emailText = primaryDoc.text.toLowerCase();
      if (!/dear|hello|hi |regards|sincerely|thank you|extension|client/.test(emailText)) {
        warnings.push("email scenario: no greeting/closing pattern detected");
      }
    }
  }

  return {
    ok: errors.length === 0,
    sessionId,
    scenarioId: scenario?.id,
    documentCount: documents.length,
    primaryDocumentId: primaryDoc?.id,
    documents: docResults,
    errors,
    warnings,
    status: sessionRes.status,
    analystSummary: sessionRes.analystSummary,
  };
}

async function main() {
  const { recordingKey, sessionId, scenarioId, baseUrl } = parseArgs();
  const scenarios = JSON.parse(readFileSync(scenariosPath, "utf8"));
  const scenario = scenarioId ? scenarios.find((s) => s.id === scenarioId) : null;

  const result = await assertSessionDocuments({
    recordingKey,
    sessionId,
    scenario,
    baseUrl,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1]?.endsWith("e2e-assert-documents.mjs")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
