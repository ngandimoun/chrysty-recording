"use client";

import { RECORDING_KEY_STORAGE } from "@/lib/recording/constants";

function createRecordingKey(): string {
  return `rk_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function getStoredRecordingKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RECORDING_KEY_STORAGE);
}

export function getOrCreateRecordingKey(): string {
  const existing = getStoredRecordingKey();
  if (existing) return existing;

  const key = createRecordingKey();
  localStorage.setItem(RECORDING_KEY_STORAGE, key);
  return key;
}

export function recordingKeyHeaders(): HeadersInit {
  return { "x-recording-key": getOrCreateRecordingKey() };
}
