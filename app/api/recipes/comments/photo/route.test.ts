// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { fetchMutation } = vi.hoisted(() => ({
  fetchMutation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("convex/nextjs", () => ({ fetchMutation }));

import { POST } from "./route";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const downloadPhoto = vi.fn();

describe("public comment photo verification route", () => {
  beforeEach(() => {
    vi.stubEnv("RECIPE_ADMIN_PASSWORD", "test-password");
    fetchMutation.mockReset();
    fetchMutation.mockResolvedValueOnce({ url: "https://example.convex.cloud/photo" }).mockResolvedValue(null);
    downloadPhoto.mockReset();
    vi.stubGlobal("fetch", downloadPhoto);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("discards bytes that cannot be decoded as the declared image type", async () => {
    downloadPhoto.mockResolvedValue(new Response("not-an-image", { headers: { "Content-Type": "image/png" } }));
    const response = await POST(verificationRequest());
    expect(response.status).toBe(400);
    expect(fetchMutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      storageId: "storage-1",
      participantKey: "a".repeat(48),
      leaseId: expect.any(String),
      adminPassword: "test-password",
    }));
  });

  test("fully decodes a supported image before marking its claim verified", async () => {
    downloadPhoto.mockResolvedValue(new Response(onePixelPng, { headers: { "Content-Type": "image/png" } }));
    const response = await POST(verificationRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ storageId: "storage-1" });
    expect(fetchMutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      storageId: "storage-1",
      participantKey: "a".repeat(48),
      leaseId: expect.any(String),
      adminPassword: "test-password",
    }));
  });

  test("rejects malformed JSON fields before calling Convex", async () => {
    const response = await POST(new Request("http://localhost/api/recipes/comments/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageId: 42, participantKey: { value: "invalid" } }),
    }));
    expect(response.status).toBe(400);
    expect(fetchMutation).not.toHaveBeenCalled();
  });
});

function verificationRequest() {
  return new Request("http://localhost/api/recipes/comments/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storageId: "storage-1", participantKey: "a".repeat(48) }),
  });
}
