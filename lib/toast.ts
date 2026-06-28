import { toast } from "sonner";
import { formatProcessingCompleteDetail } from "@/lib/processing/pipeline-ui";

const UPLOAD_TOAST_ID = "recording-upload";
const PROCESS_TOAST_ID = "recording-process";

export function toastUploading() {
  return toast.loading("Uploading recording…", { id: UPLOAD_TOAST_ID });
}

export function toastRecordingSaved() {
  toast.success("Recording saved", { id: UPLOAD_TOAST_ID });
}

export function toastUploadFailed(message: string) {
  toast.error(message, { id: UPLOAD_TOAST_ID });
}

export function toastProcessingStarted() {
  toast.info("Learning from your recording…", { id: PROCESS_TOAST_ID, duration: 4000 });
}

export function toastProcessingComplete(counts?: {
  observationCount?: number;
  objectCount?: number;
}) {
  const detail = formatProcessingCompleteDetail(
    counts?.observationCount,
    counts?.objectCount
  );
  toast.success("Your world model is updated", { id: PROCESS_TOAST_ID, description: detail });
}

export function toastProcessingFailed(message: string, onRetry?: () => void) {
  toast.error(message, {
    id: PROCESS_TOAST_ID,
    action: onRetry ? { label: "Retry", onClick: onRetry } : undefined,
  });
}

export function toastSaved(label = "Saved") {
  toast.success(label);
}

export function toastDeleted(label = "Deleted") {
  toast.success(label);
}

export function toastError(message: string) {
  toast.error(message);
}
