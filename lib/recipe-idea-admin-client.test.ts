import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createAdminRecipeIdea,
  getAdminRecipeIdea,
  getAdminRecipeIdeaCount,
  listAdminRecipeIdeas,
  removeAdminRecipeIdea,
} from "./recipe-idea-admin-client";

describe("protected recipe idea admin client", () => {
  const convexFetch = vi.fn();

  beforeEach(() => {
    convexFetch.mockReset();
    vi.stubGlobal("fetch", convexFetch);
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://example.convex.site");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("lists twenty-item pages through the authenticated internal endpoint", async () => {
    convexFetch.mockResolvedValue(
      Response.json({ page: [], isDone: true, continueCursor: "" }),
    );
    await listAdminRecipeIdeas("secret", "outstanding", "fr", "cursor-1");
    expect(convexFetch).toHaveBeenCalledWith(
      "https://example.convex.site/internal/admin/recipe-ideas?state=outstanding&locale=fr&cursor=cursor-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
        cache: "no-store",
      }),
    );
  });

  test("uses protected endpoints for count and safe item lookup", async () => {
    convexFetch
      .mockResolvedValueOnce(Response.json({ count: 4 }))
      .mockResolvedValueOnce(Response.json(null));
    await expect(getAdminRecipeIdeaCount("secret")).resolves.toBe(4);
    await expect(
      getAdminRecipeIdea("secret", "not-a-convex-id", "en"),
    ).resolves.toBeNull();
    expect(convexFetch.mock.calls[1]?.[0]).toBe(
      "https://example.convex.site/internal/admin/recipe-ideas/item?ideaId=not-a-convex-id&locale=en",
    );
  });

  test("creates and deletes without putting the password in the payload", async () => {
    convexFetch
      .mockResolvedValueOnce(Response.json({ ideaId: "idea-1" }))
      .mockResolvedValueOnce(Response.json({ ideaId: "idea-1" }));
    await createAdminRecipeIdea("secret", {
      authorName: "Maman",
      text: "Des bugnes",
    });
    await removeAdminRecipeIdea("secret", "idea-1");
    expect(convexFetch.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ authorName: "Maman", text: "Des bugnes" }),
    });
    expect(convexFetch.mock.calls[1]?.[1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ ideaId: "idea-1" }),
    });
    expect(String(convexFetch.mock.calls[0]?.[1]?.body)).not.toContain("secret");
  });
});
