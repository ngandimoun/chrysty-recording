import { NextResponse, type NextRequest } from "next/server";

import {
  assertAuthenticatedRequest,
  respondPlatformAccessError,
} from "@/lib/chrysty/guard";
import { ensureRecordingWorkspace } from "@/lib/recording/workspace";
import { resolveIdentityFromRequest, type RecordingIdentity } from "@/lib/recording/resolve-identity";

export class RecordingIdentityError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function respondRecordingIdentityError(error: unknown): NextResponse | null {
  if (error instanceof RecordingIdentityError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Request failed";
}

export async function requireRecordingIdentity(
  request: NextRequest,
  options?: { ensureWorkspace?: boolean }
): Promise<RecordingIdentity> {
  const identity = await resolveIdentityFromRequest(request);
  if (!identity) {
    throw new RecordingIdentityError(400, "Missing or invalid recording key");
  }
  if (!identity.recordingKey.startsWith("rk_")) {
    throw new RecordingIdentityError(400, "Invalid recording key format");
  }
  if (options?.ensureWorkspace !== false) {
    await ensureRecordingWorkspace(identity.recordingKey, identity.userId);
  }
  return identity;
}

export async function requireAuthenticatedRecordingIdentity(
  request: NextRequest,
  options?: { ensureWorkspace?: boolean }
): Promise<RecordingIdentity | NextResponse> {
  try {
    await assertAuthenticatedRequest(request);
  } catch (error) {
    const response = respondPlatformAccessError(error);
    if (response) return response;
    throw error;
  }

  try {
    return await requireRecordingIdentity(request, options);
  } catch (error) {
    const response = respondRecordingIdentityError(error);
    if (response) return response;
    throw error;
  }
}
