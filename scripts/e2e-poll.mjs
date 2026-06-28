#!/usr/bin/env node
/**
 * Poll processing status until completed or failed.
 * Usage: node scripts/e2e-poll.mjs --key rk_... --session rec-... [--base http://localhost:3000]
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let recordingKey = null;
  let sessionId = null;
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key" && args[i + 1]) recordingKey = args[++i];
    else if (args[i] === "--session" && args[i + 1]) sessionId = args[++i];
    else if (args[i] === "--base" && args[i + 1]) baseUrl = args[++i];
  }
  if (!recordingKey || !sessionId) {
    console.error("Usage: node scripts/e2e-poll.mjs --key rk_... --session rec-...");
    process.exit(1);
  }
  return { recordingKey, sessionId, baseUrl: baseUrl.replace(/\/$/, "") };
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
  console.log(JSON.stringify({ step: "start", status: res.status, body }));
  return res.ok;
}

async function pollOnce(baseUrl, recordingKey, sessionId) {
  const url = `${baseUrl}/api/recordings/process?sessionId=${encodeURIComponent(sessionId)}`;
  const res = await fetch(url, { headers: { "x-recording-key": recordingKey } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Poll failed ${res.status}`);
  return body;
}

async function main() {
  const { recordingKey, sessionId, baseUrl } = parseArgs();
  const phasesSeen = new Set();
  const startedAt = Date.now();

  await startProcessing(baseUrl, recordingKey, sessionId);

  while (Date.now() - startedAt < 300_000) {
    const body = await pollOnce(baseUrl, recordingKey, sessionId);
    if (body.pipelinePhase) phasesSeen.add(body.pipelinePhase);
    console.log(
      JSON.stringify({
        t: Math.round((Date.now() - startedAt) / 1000),
        status: body.status,
        step: body.processingStep,
        phase: body.pipelinePhase,
        observations: body.observationCount,
        objects: body.objectCount,
        enrichment: body.enrichmentStatus,
      })
    );

    if (body.status === "completed") {
      console.log(
        JSON.stringify(
          {
            ok: true,
            elapsedSec: Math.round((Date.now() - startedAt) / 1000),
            phasesSeen: [...phasesSeen],
            final: body,
          },
          null,
          2
        )
      );
      return;
    }
    if (body.status === "failed") {
      console.error(JSON.stringify({ ok: false, error: body.errorMessage, body }, null, 2));
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.error(JSON.stringify({ ok: false, error: "Timeout after 300s", phasesSeen: [...phasesSeen] }));
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
