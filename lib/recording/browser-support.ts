"use client";

import { extensionForMime } from "@/lib/recording/audio-format";

export { extensionForMime };

const MIME_CANDIDATES_SAFARI = [
  "audio/mp4",
  "audio/aac",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

const MIME_CANDIDATES_DEFAULT = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/aac",
];

export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

export function isSecureRecordingContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext;
}

export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined";
}

export function requiresUserGesture(): boolean {
  return isApplePlatform();
}

export function supportsPauseResume(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  return typeof MediaRecorder.prototype.pause === "function";
}

export function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export interface RecorderConfig {
  mimeType: string | undefined;
  extension: string;
}

export function getRecorderConfig(): RecorderConfig {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: undefined, extension: "webm" };
  }

  const candidates = isApplePlatform() ? MIME_CANDIDATES_SAFARI : MIME_CANDIDATES_DEFAULT;
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, extension: extensionForMime(type) };
    }
  }

  return { mimeType: undefined, extension: "webm" };
}

export function getRecordingUnavailableMessage(): string | null {
  if (!isSecureRecordingContext()) {
    return "Voice recording requires a secure connection (HTTPS). Open this app over HTTPS or localhost.";
  }
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "This browser does not support microphone recording.";
  }
  if (!isMediaRecorderSupported()) {
    return "This browser does not support audio recording (MediaRecorder unavailable).";
  }
  return null;
}
