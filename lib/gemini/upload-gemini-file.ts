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

const UNSUPPORTED_GEMINI_AUDIO_MIMES = new Set([
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
]);

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

function normalizeMime(mime: string | undefined): string | undefined {
  if (!mime) return undefined;
  return mime.split(";")[0].trim().toLowerCase();
}

function isUnsupportedGeminiAudioMime(mime: string | undefined): boolean {
  const base = normalizeMime(mime);
  return base !== undefined && UNSUPPORTED_GEMINI_AUDIO_MIMES.has(base);
}

export const TRANSCRIPTION_INLINE_MIME = "audio/mpeg";

function extensionFromStoragePath(storagePath: string): string {
  const fromName = extensionFromFilename(storagePath);
  if (fromName) return fromName === "mp4" ? "m4a" : fromName;
  if (storagePath.includes("webm")) return "webm";
  if (storagePath.includes("m4a")) return "m4a";
  return "webm";
}

export function resolveSessionInputExtension(
  storagePath: string,
  recorderMimeType?: string,
  storageContentType?: string
): string {
  const fromStorage = normalizeMime(storageContentType);
  if (fromStorage?.startsWith("audio/")) {
    return extensionForMime(fromStorage);
  }
  if (recorderMimeType) {
    return extensionForMime(recorderMimeType);
  }
  return extensionFromStoragePath(storagePath);
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Audio transcode failed (inputExt=${inputExt}): ${detail}`);
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
  if (options.mimeType) {
    return extensionForMime(options.mimeType);
  }

  if (options.ext) {
    return options.ext === "mp4" ? "m4a" : options.ext;
  }

  const fromName = options.fileName ? extensionFromFilename(options.fileName) : null;
  if (fromName) {
    return fromName === "mp4" ? "m4a" : fromName;
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

async function prepareSessionAudioForGemini(
  buffer: Buffer,
  inputExt: string
): Promise<Buffer> {
  if (inputExt === "mp3") return buffer;
  return convertAudioToMp3(buffer, inputExt);
}

export function buildTranscriptionAudioInput(buffer: Buffer) {
  return {
    type: "audio" as const,
    data: buffer.toString("base64"),
    mime_type: TRANSCRIPTION_INLINE_MIME,
  };
}

export async function prepareSessionAudioForTranscription(
  storagePath: string,
  recorderMimeType?: string
): Promise<{
  buffer: Buffer;
  mimeType: string;
  inputExt: string;
  storageContentType?: string;
}> {
  const bucket = getUploadsBucket();
  const { data, error } = await createAdminClient().storage.from(bucket).download(storagePath);
  if (error || !data) throw error ?? new Error("Failed to download file");

  const raw = Buffer.from(await data.arrayBuffer());
  const storageContentType = data.type || undefined;
  const inputExt = resolveSessionInputExtension(
    storagePath,
    recorderMimeType,
    storageContentType
  );
  const buffer = await prepareSessionAudioForGemini(raw, inputExt);

  return {
    buffer,
    mimeType: TRANSCRIPTION_INLINE_MIME,
    inputExt,
    storageContentType: normalizeMime(storageContentType),
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
  sessionId: string,
  recorderMimeType?: string
): Promise<{ uri: string; mimeType: string }> {
  const raw = await downloadSessionFile(storagePath);
  const inputExt = resolveSessionInputExtension(storagePath, recorderMimeType);
  const mp3Buffer = await prepareSessionAudioForGemini(raw, inputExt);

  let file = await uploadBufferToGemini(mp3Buffer, "audio/mp3", `${sessionId}-audio`);
  if (!file.uri) throw new Error("Gemini file missing uri");

  if (isUnsupportedGeminiAudioMime(file.mimeType)) {
    const pathExt = extensionFromStoragePath(storagePath);
    const retryExt =
      recorderMimeType && pathExt !== inputExt
        ? pathExt
        : recorderMimeType
          ? extensionForMime(recorderMimeType)
          : pathExt;
    const retriedBuffer = await prepareSessionAudioForGemini(raw, retryExt);
    file = await uploadBufferToGemini(retriedBuffer, "audio/mp3", `${sessionId}-audio-retry`);
    if (!file.uri) throw new Error("Gemini file missing uri after retry");
    if (isUnsupportedGeminiAudioMime(file.mimeType)) {
      throw new Error(
        `Gemini registered unsupported audio MIME after transcode (path=${storagePath}, inputExt=${inputExt}, retryExt=${retryExt}, geminiMime=${normalizeMime(file.mimeType) ?? "unknown"})`
      );
    }
  }

  return { uri: file.uri, mimeType: "audio/mp3" };
}
