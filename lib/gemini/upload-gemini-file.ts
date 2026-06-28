import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extensionForMime,
  extensionFromFilename,
  geminiMimeForExtension,
  needsAudioTranscode,
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

async function assertFfmpegAvailable(ffmpegPath: string): Promise<void> {
  try {
    await access(ffmpegPath);
  } catch {
    throw new Error("Audio transcoder unavailable in this environment");
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
    await assertFfmpegAvailable(ffmpegPath);
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

function resolveAudioExtension(options: {
  ext?: string;
  mimeType?: string;
  fileName?: string;
}): string {
  if (options.ext) {
    return options.ext === "mp4" ? "m4a" : options.ext;
  }

  const fromName = options.fileName ? extensionFromFilename(options.fileName) : null;
  if (fromName) {
    return fromName === "mp4" ? "m4a" : fromName;
  }

  if (options.mimeType) {
    return extensionForMime(options.mimeType);
  }

  return "webm";
}

export async function prepareAudioForGemini(
  buffer: Buffer,
  options: { ext?: string; mimeType?: string; fileName?: string } = {}
): Promise<{ buffer: Buffer; mimeType: string }> {
  const ext = resolveAudioExtension(options);

  if (needsAudioTranscode(ext)) {
    return {
      buffer: await convertAudioToMp3(buffer, ext),
      mimeType: "audio/mp3",
    };
  }

  return {
    buffer,
    mimeType: geminiMimeForExtension(ext),
  };
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
  const { buffer, mimeType } = await prepareAudioForGemini(raw, { ext });

  const file = await uploadBufferToGemini(buffer, mimeType, `${sessionId}-audio`);
  if (!file.uri) throw new Error("Gemini file missing uri");
  return { uri: file.uri, mimeType };
}
