"use client";

import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { useRecordingStore } from "@/stores/recording-store";
import { MAX_CONTEXT_FILES } from "@/lib/context/constants";

export function AddContextButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { contextFiles, addContextFiles, removeContextFile, clearContextFiles } =
    useRecordingStore();

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addContextFiles(files);
    e.target.value = "";
  };

  const atLimit = contextFiles.length >= MAX_CONTEXT_FILES;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2">
      <div className="flex w-full items-center justify-center gap-3 border-y border-border py-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={atLimit}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Paperclip className="size-4" />
          Add context
        </button>

        {contextFiles.length > 0 && (
          <span className="text-sm text-muted-foreground">
            · {contextFiles.length} item{contextFiles.length === 1 ? "" : "s"} added
          </span>
        )}
      </div>

      {contextFiles.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {contextFiles.map((_, index) => (
            <button
              key={`${contextFiles[index].name}-${index}`}
              type="button"
              onClick={() => removeContextFile(index)}
              className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Remove context item ${index + 1}`}
            >
              <X className="size-3.5" />
            </button>
          ))}
          {contextFiles.length > 1 && (
            <button
              type="button"
              onClick={clearContextFiles}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleSelect}
      />
    </div>
  );
}
