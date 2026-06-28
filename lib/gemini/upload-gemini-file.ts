import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extensionFromFilename,
  geminiMimeForExtension,
  needsTranscodeToMp3,
} from "@/lib/recording/audio-format";
import { getGeminiClient } from "@/lib/gemini/client";
import { createAdminClient, getUploadsBucket } from "@/lib/supabase/admin";

const execFileAsync = promisify(execFile);

function getFfmpegPath(): string {
  try {
    // Runtime require — ffmpeg-static is externalized in next.config.ts
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static") as string | null;
    return ffmpegStatic ?? "ffmpeg";
  } catch {
    return "ffmpeg";
  }
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionFromStoragePath(storagePath: string): string {
  const fromName = extensionFromFilename(storagePath);
  if (fromName) return fromName === "mp4" ? "m4a" : fromName;
  if (storagePath.includes("webm")) return "webm";
  if (storagePath.includes("m4a")) return "m4a";
  return "webm";
}

async function convertAudioToMp3(input: Buffer, inputExt: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "chrysty-audio-"));
  const inputPath = join(dir, `input.${inputExt}`);
  const outputPath = join(dir, "output.mp3");
  try {
    await writeFile(inputPath, input);
    const ffmpegPath = getFfmpegPath();
    await execFileAsync(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-q:a",
      "4",
      outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function downloadFromSupabase(bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await createAdminClient().storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error("Failed to download file");
  return Buffer.from(await data.arrayBuffer());
}

export async function downloadSessionFile(storagePath: string): Promise<Buffer> {
  return downloadFromSupabase(getUploadsBucket(), storagePath);
}

export async function waitForGeminiFile(name: string) {
  const client = getGeminiClient();
  let file = await client.files.get({ name });
  while (file.state === "PROCESSING") {
    await sleep(2000);
    file = await client.files.get({ name });
  }
  if (file.state === "FAILED") {
    throw new Error("Gemini file processing failed");
  }
  return file;
}

export async function uploadBufferToGemini(
  buffer: Buffer,
  mimeType: string,
  displayName?: string
) {
  const client = getGeminiClient();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  const file = await client.files.upload({
    file: blob,
    config: { mimeType, displayName },
  });
  if (!file.name) throw new Error("Upload did not return file name");
  return waitForGeminiFile(file.name);
}

export async function uploadAudioFromSupabase(
  storagePath: string,
  sessionId: string
): Promise<{ uri: string; mimeType: string }> {
  const raw = await downloadSessionFile(storagePath);
  const ext = extensionFromStoragePath(storagePath);
  let buffer = raw;
  let mimeType = geminiMimeForExtension(ext);

  if (needsTranscodeToMp3(ext)) {
    buffer = await convertAudioToMp3(raw, ext);
    mimeType = "audio/mp3";
  }

  const file = await uploadBufferToGemini(buffer, mimeType, `${sessionId}-audio`);
  if (!file.uri) throw new Error("Gemini file missing uri");
  return { uri: file.uri, mimeType };
}
