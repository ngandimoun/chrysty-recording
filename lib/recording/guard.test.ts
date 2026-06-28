import { describe, expect, it } from "vitest";
import {
  RecordingIdentityError,
  respondRecordingIdentityError,
} from "@/lib/recording/guard";

describe("recording guard", () => {
  it("maps RecordingIdentityError to JSON response", async () => {
    const error = new RecordingIdentityError(400, "Missing or invalid recording key");
    const response = respondRecordingIdentityError(error);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      error: "Missing or invalid recording key",
    });
  });

  it("returns null for non-identity errors", () => {
    expect(respondRecordingIdentityError(new Error("other"))).toBeNull();
  });
});
