/**
 * Upload a speech fixture through the production upload API.
 * Usage: node scripts/e2e-upload.mjs [--key rk_...] [--base URL] [--fixture path] [--duration N]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const defaultFixture = join(root, "tests", "fixtures", "sample-speech.webm");

function parseArgs() {
  const args = process.argv.slice(2);
  let recordingKey = null;
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let fixturePath = defaultFixture;
  let durationSeconds = 15;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key" && args[i + 1]) recordingKey = args[++i];
    else if (args[i] === "--base" && args[i + 1]) baseUrl = args[++i];
    else if (args[i] === "--fixture" && args[i + 1]) fixturePath = args[++i];
    else if (args[i] === "--duration" && args[i + 1]) durationSeconds = Number(args[++i]);
  }
  if (!recordingKey) {
    recordingKey = `rk_${randomUUID().replace(/-/g, "")}`;
  }
  return {
    recordingKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    fixturePath: fixturePath.startsWith("/") || /^[A-Za-z]:/.test(fixturePath)
      ? fixturePath
      : join(root, fixturePath),
    durationSeconds,
  };
}

export async function uploadFixture({
  recordingKey,
  baseUrl,
  fixturePath,
  durationSeconds,
  sessionIdPrefix = "rec-e2e",
}) {
  const audio = readFileSync(fixturePath);
  const sessionId = `${sessionIdPrefix}-${Date.now()}`;
  const form = new FormData();
  form.append("audio", new Blob([audio], { type: "audio/webm" }), "recording.webm");
  form.append("sessionId", sessionId);
  form.append("durationSeconds", String(durationSeconds));
  form.append("clientTimezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  form.append("recorderMimeType", "audio/webm");

  const res = await fetch(`${baseUrl}/api/recordings/upload`, {
    method: "POST",
    headers: { "x-recording-key": recordingKey },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }

  return {
    recordingKey,
    sessionId: body.sessionId ?? sessionId,
    storagePath: body.storagePath,
    attachmentCount: body.attachmentCount,
  };
}

async function main() {
  const opts = parseArgs();
  const result = await uploadFixture(opts);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
