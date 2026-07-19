import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { convexFetch, getRecipeAdminAccess, adminUnauthorizedResponse } = vi.hoisted(() => ({
  convexFetch: vi.fn(),
  getRecipeAdminAccess: vi.fn(),
  adminUnauthorizedResponse: vi.fn(() => Response.json({ error: "Accès admin requis." }, { status: 401 })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/recipe-admin-auth", () => ({ getRecipeAdminAccess, adminUnauthorizedResponse }));

import { DELETE, GET } from "./route";

describe("recipe comment moderation route", () => {
  beforeEach(() => {
    convexFetch.mockReset();
    vi.stubGlobal("fetch", convexFetch);
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://example.convex.site");
    getRecipeAdminAccess.mockResolvedValue({ ok: true, adminPassword: "test-password" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("rejects moderation without the existing admin session", async () => {
    getRecipeAdminAccess.mockResolvedValue({ ok: false, status: 401, message: "Accès admin requis." });
    const response = await GET(new Request("http://localhost/api/admin/recipes/comments?slug=tarte") as never);
    expect(response.status).toBe(401);
    expect(convexFetch).not.toHaveBeenCalled();
  });

  test("returns a protected page of comments", async () => {
    convexFetch.mockResolvedValue(Response.json({ page: [{ _id: "comment-1", text: "Délicieuse" }], isDone: true, continueCursor: "" }));
    const response = await GET(new Request("http://localhost/api/admin/recipes/comments?slug=tarte&cursor=") as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ page: [{ text: "Délicieuse" }] });
    expect(convexFetch).toHaveBeenCalledWith(
      "https://example.convex.site/internal/admin/recipe-comments?slug=tarte",
      expect.objectContaining({ headers: { Authorization: "Bearer test-password" } }),
    );
  });

  test("deletes a comment through the protected mutation", async () => {
    convexFetch.mockResolvedValue(Response.json({ type: "success", commentId: "comment-1" }));
    const response = await DELETE(new Request("http://localhost/api/admin/recipes/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: "comment-1" }),
    }) as never);
    expect(response.status).toBe(200);
    expect(convexFetch).toHaveBeenCalledWith(
      "https://example.convex.site/internal/admin/recipe-comments",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: "Bearer test-password" }),
        body: JSON.stringify({ commentId: "comment-1" }),
      }),
    );
  });

  test("rejects malformed delete payloads before contacting Convex", async () => {
    const response = await DELETE(new Request("http://localhost/api/admin/recipes/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: 42 }),
    }) as never);
    expect(response.status).toBe(400);
    expect(convexFetch).not.toHaveBeenCalled();
  });
});
