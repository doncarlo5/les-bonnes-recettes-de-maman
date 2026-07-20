import { beforeEach, describe, expect, test, vi } from "vitest";

const { fetchMutation } = vi.hoisted(() => ({ fetchMutation: vi.fn() }));

vi.mock("convex/nextjs", () => ({ fetchMutation }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/recipe-admin-auth", () => ({
  getRecipeAdminAccess: vi.fn(async () => ({
    ok: true,
    adminPassword: "test-password",
  })),
  adminUnauthorizedResponse: vi.fn(),
}));

import { POST } from "./route";

function request(body: string) {
  return new Request("http://localhost/api/admin/openverse/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("Openverse import route", () => {
  beforeEach(() => {
    fetchMutation.mockReset();
    vi.unstubAllGlobals();
  });

  test("returns typed validation for malformed JSON and invalid URLs", async () => {
    const malformed = await POST(request("{") as never);
    const invalidUrl = await POST(
      request(
        JSON.stringify({ imageUrl: "http://example.com/photo.jpg" }),
      ) as never,
    );

    expect(await malformed.json()).toMatchObject({ type: "validation" });
    expect(await invalidUrl.json()).toMatchObject({
      type: "validation",
      fieldErrors: { imageUrl: expect.any(String) },
    });
  });

  test("normalizes provider and storage failures to typed errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    const downloadFailure = await POST(
      request(
        JSON.stringify({ imageUrl: "https://example.com/photo.jpg" }),
      ) as never,
    );
    expect(downloadFailure.status).toBe(502);
    expect(await downloadFailure.json()).toEqual({
      type: "error",
      message: "Impossible de télécharger l’image Openverse.",
    });

    fetchMutation.mockResolvedValue("https://storage.example/upload");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(new Blob(["image"], { type: "image/jpeg" }), {
            headers: { "Content-Type": "image/jpeg" },
          }),
        )
        .mockResolvedValueOnce(Response.json({ unexpected: true })),
    );
    const invalidStorage = await POST(
      request(
        JSON.stringify({ imageUrl: "https://example.com/photo.jpg" }),
      ) as never,
    );
    expect(invalidStorage.status).toBe(502);
    expect(await invalidStorage.json()).toMatchObject({ type: "error" });
  });

  test("returns the validated storage identifier after upload", async () => {
    fetchMutation.mockResolvedValue("https://storage.example/upload");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(new Blob(["image"], { type: "image/jpeg" }), {
            headers: { "Content-Type": "image/jpeg" },
          }),
        )
        .mockResolvedValueOnce(Response.json({ storageId: "storage-id" })),
    );

    const response = await POST(
      request(
        JSON.stringify({ imageUrl: "https://example.com/photo.jpg" }),
      ) as never,
    );
    expect(await response.json()).toEqual({
      type: "success",
      storageId: "storage-id",
    });
  });
});
