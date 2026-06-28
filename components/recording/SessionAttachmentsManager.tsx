"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Trash2, Upload } from "lucide-react";
import {
  deleteAttachment,
  fetchAttachments,
  uploadAttachment,
} from "@/lib/data-client";
import { toastDeleted, toastError, toastSaved } from "@/lib/toast";

interface SessionAttachmentsManagerProps {
  sessionId: string;
  editable: boolean;
}

export function SessionAttachmentsManager({
  sessionId,
  editable,
}: SessionAttachmentsManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<
    Array<{ id: string; fileName: string; mimeType: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    fetchAttachments(sessionId)
      .then((rows) =>
        setAttachments(rows.map((r) => ({ id: r.id, fileName: r.fileName, mimeType: r.mimeType })))
      )
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadAttachment(sessionId, file);
      toastSaved("Context file added");
      reload();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      await deleteAttachment(sessionId, attachmentId);
      toastDeleted("Attachment removed");
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading attachments…</p>;
  }

  return (
    <div className="space-y-3 rounded-[20px] border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Paperclip className="size-4" />
          Context files
        </div>
        {editable && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-accent hover:underline disabled:opacity-50"
            >
              <Upload className="size-3.5" />
              Add file
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
          </>
        )}
      </div>
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No context files attached.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="truncate text-foreground">{a.fileName}</span>
              {editable && (
                <button
                  type="button"
                  onClick={() => void handleDelete(a.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${a.fileName}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
