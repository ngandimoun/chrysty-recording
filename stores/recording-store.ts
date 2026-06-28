"use client";

import { create } from "zustand";
import { MAX_CONTEXT_FILES } from "@/lib/context/constants";
import {
  extensionForMime,
  getClientTimezone,
  getMediaRecorderTimesliceMs,
  getRecorderConfig,
  isApplePlatform,
} from "@/lib/recording/browser-support";
import { uploadRecordingKeyHeaders } from "@/lib/recording/recording-key";
import type { KnowledgeObject } from "@/types";

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  sessionId: string | null;
  mediaRecorder: MediaRecorder | null;
  recorderMimeType: string;
  audioExtension: string;
  audioChunks: Blob[];
  contextFiles: File[];
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  addContextFiles: (files: File[]) => void;
  removeContextFile: (index: number) => void;
  clearContextFiles: () => void;
  finishRecording: () => Promise<string>;
  tick: () => void;
  reset: () => void;
}

function generateSessionId() {
  return `rec-${Date.now()}`;
}

function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

function stopMediaRecorder(mediaRecorder: MediaRecorder | null) {
  if (!mediaRecorder) return;
  const stream = mediaRecorder.stream;
  if (mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  stopStream(stream);
}

/** Bumps when capture should abort (cancel, unmount, or a new start). */
let captureGeneration = 0;

export const useRecordingStore = create<RecordingState>((set, get) => ({
  isRecording: false,
  isPaused: false,
  elapsedSeconds: 0,
  sessionId: null,
  mediaRecorder: null,
  recorderMimeType: "audio/webm",
  audioExtension: "webm",
  audioChunks: [],
  contextFiles: [],

  startRecording: async () => {
    const generation = ++captureGeneration;
    stopMediaRecorder(get().mediaRecorder);

    const sessionId = generateSessionId();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      if (generation === captureGeneration) {
        throw error;
      }
      return;
    }

    if (generation !== captureGeneration) {
      stopStream(stream);
      return;
    }

    const { mimeType, extension } = getRecorderConfig();
    const recorderOptions = mimeType ? { mimeType } : undefined;
    const mediaRecorder = new MediaRecorder(stream, recorderOptions);
    const audioChunks: Blob[] = [];
    const resolvedMime = mediaRecorder.mimeType || mimeType || "audio/webm";

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onerror = () => {
      if (generation === captureGeneration) {
        stopStream(stream);
      }
    };

    const timeslice = getMediaRecorderTimesliceMs();
    if (timeslice === undefined) {
      mediaRecorder.start();
    } else {
      mediaRecorder.start(timeslice);
    }

    set({
      isRecording: true,
      isPaused: false,
      elapsedSeconds: 0,
      sessionId,
      mediaRecorder,
      recorderMimeType: resolvedMime,
      audioExtension: extensionForMime(resolvedMime) || extension,
      audioChunks,
      contextFiles: [],
    });
  },

  pauseRecording: () => {
    const { mediaRecorder } = get();
    if (mediaRecorder?.state === "recording") mediaRecorder.pause();
    set({ isPaused: true });
  },

  resumeRecording: () => {
    const { mediaRecorder } = get();
    if (mediaRecorder?.state === "paused") mediaRecorder.resume();
    set({ isPaused: false });
  },

  addContextFiles: (files) => {
    const { contextFiles } = get();
    const remaining = MAX_CONTEXT_FILES - contextFiles.length;
    if (remaining <= 0) return;
    set({ contextFiles: [...contextFiles, ...files.slice(0, remaining)] });
  },

  removeContextFile: (index) => {
    const { contextFiles } = get();
    set({ contextFiles: contextFiles.filter((_, i) => i !== index) });
  },

  clearContextFiles: () => set({ contextFiles: [] }),

  finishRecording: async () => {
    const {
      mediaRecorder,
      sessionId,
      audioChunks,
      elapsedSeconds,
      contextFiles,
      recorderMimeType,
    } = get();
    const id = sessionId ?? generateSessionId();

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      await new Promise<void>((resolve, reject) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.onerror = () => reject(new Error("Recording failed"));
        void (async () => {
          try {
            if (typeof mediaRecorder.requestData === "function") {
              mediaRecorder.requestData();
            }
            if (isApplePlatform()) {
              await new Promise((r) => setTimeout(r, 150));
            }
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach((t) => t.stop());
          } catch (err) {
            reject(err instanceof Error ? err : new Error("Recording failed"));
          }
        })();
      });
    }

    const chunks = get().audioChunks.length ? get().audioChunks : audioChunks;
    const mimeType = mediaRecorder?.mimeType || recorderMimeType || "audio/webm";
    const blob = new Blob(chunks, { type: mimeType });

    if (blob.size < 1024) {
      throw new Error("Recording was too short or empty. Please try again.");
    }

    const ext = extensionForMime(mimeType);
    const formData = new FormData();
    formData.append("audio", blob, `recording.${ext}`);
    formData.append("sessionId", id);
    formData.append("durationSeconds", String(elapsedSeconds));
    formData.append("clientTimezone", getClientTimezone());
    formData.append("recorderMimeType", mimeType);
    for (const file of contextFiles) {
      formData.append("context", file, file.name);
    }

    const uploadRes = await fetch("/api/recordings/upload", {
      method: "POST",
      credentials: "include",
      headers: uploadRecordingKeyHeaders(),
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to upload recording");
    }

    set({
      isRecording: false,
      isPaused: false,
      mediaRecorder: null,
      audioChunks: [],
      contextFiles: [],
    });

    return id;
  },

  tick: () => {
    const { isRecording, isPaused, elapsedSeconds } = get();
    if (isRecording && !isPaused) {
      set({ elapsedSeconds: elapsedSeconds + 1 });
    }
  },

  reset: () => {
    captureGeneration += 1;
    stopMediaRecorder(get().mediaRecorder);
    set({
      isRecording: false,
      isPaused: false,
      elapsedSeconds: 0,
      sessionId: null,
      mediaRecorder: null,
      recorderMimeType: "audio/webm",
      audioExtension: "webm",
      audioChunks: [],
      contextFiles: [],
    });
  },
}));

export type { KnowledgeObject };
