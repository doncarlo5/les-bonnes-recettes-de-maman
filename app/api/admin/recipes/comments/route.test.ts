import { beforeEach, describe, expect, test, vi } from "vitest";

const { fetchQuery, fetchMutation, getRecipeAdminAccess, adminUnauthorizedResponse } = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  fetchMutation: vi.fn(),
  getRecipeAdminAccess: vi.fn(),
  adminUnauthorizedResponse: vi.fn(() => Response.json({ error: "Accès admin requis." }, { status: 401 })),
}));

vi.mock("convex/nextjs", () => ({ fetchQuery, fetchMutation }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/recipe-admin-auth", () => ({ getRecipeAdminAccess, adminUnauthorizedResponse }));

import { DELETE, GET } from "./route";

describe("recipe comment moderation route", () => {
  beforeEach(() => {
    fetchQuery.mockReset();
    fetchMutation.mockReset();
    getRecipeAdminAccess.mockResolvedValue({ ok: true, adminPassword: "test-password" });
  });

  test("rejects moderation without the existing admin session", async () => {
    getRecipeAdminAccess.mockResolvedValue({ ok: false, status: 401, message: "Accès admin requis." });
    const response = await GET(new Request("http://localhost/api/admin/recipes/comments?slug=tarte") as never);
    expect(response.status).toBe(401);
    expect(fetchQuery).not.toHaveBeenCalled();
  });

  test("returns a protected page of comments", async () => {
    fetchQuery.mockResolvedValue({ page: [{ _id: "comment-1", text: "Délicieuse" }], isDone: true, continueCursor: "" });
    const response = await GET(new Request("http://localhost/api/admin/recipes/comments?slug=tarte&cursor=") as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ page: [{ text: "Délicieuse" }] });
    expect(fetchQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ slug: "tarte", adminPassword: "test-password" }));
  });

  test("deletes a comment through the protected mutation", async () => {
    const response = await DELETE(new Request("http://localhost/api/admin/recipes/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: "comment-1" }),
    }) as never);
    expect(response.status).toBe(200);
    expect(fetchMutation).toHaveBeenCalledWith(expect.anything(), { commentId: "comment-1", adminPassword: "test-password" });
  });
});
