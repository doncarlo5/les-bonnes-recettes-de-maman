import { beforeEach, describe, expect, test, vi } from "vitest";

const { fetchMutation, revalidateRecipePaths } = vi.hoisted(() => ({
  fetchMutation: vi.fn(),
  revalidateRecipePaths: vi.fn(),
}));

vi.mock("convex/nextjs", () => ({ fetchMutation }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/recipe-admin-auth", () => ({
  getRecipeAdminAccess: vi.fn(async () => ({ ok: true, adminPassword: "test-password" })),
  adminUnauthorizedResponse: vi.fn(),
}));
vi.mock("@/lib/recipe-admin-revalidate", () => ({ revalidateRecipePaths }));

import { POST as saveRecipe } from "./save/route";
import { POST as discardRecipe } from "./discard-draft/route";
import { POST as setHeroImage } from "./hero-image/route";
import { POST as setUnsplashImage } from "./unsplash-hero-image/route";
import { POST as setOpenverseImage } from "../openverse/import/route";
import { POST as publishRecipe } from "./publish/route";
import { POST as unpublishRecipe } from "./unpublish/route";
import { DELETE as deleteRecipe } from "./delete/route";

const localized = {
  title: "Tarte mobile",
  author: "Maman",
  description: "Une recette",
  yieldLabel: "",
  prepTime: "10 min",
  cookTime: "",
  totalTime: "",
  timeLabel: "",
  temperature: "",
  ingredients: [{ name: "Farine", quantity: "100", unit: "g", notes: "" }],
  sections: [{ title: "Préparation", steps: ["Mélanger"] }],
  subRecipes: [],
  notes: [],
};
const payload = { defaultLocale: "fr", referenceServings: 6, translations: { fr: localized, en: localized }, categories: [] };

function request(body: unknown) {
  return new Request("http://localhost/api/admin/recipes/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("recipe admin route contracts", () => {
  beforeEach(() => {
    fetchMutation.mockReset();
    revalidateRecipePaths.mockReset();
  });

  test("save returns slug, revision, and savedAt", async () => {
    fetchMutation.mockResolvedValue({ slug: "tarte-mobile", title: "Tarte mobile", revision: 4, savedAt: 1234 });
    const response = await saveRecipe(request({ locale: "fr", mode: "update", slug: "tarte-mobile", expectedRevision: 3, recipePayload: JSON.stringify(payload) }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ slug: "tarte-mobile", revision: 4, savedAt: 1234 });
  });

  test("save rejects reference servings outside the public selector bounds", async () => {
    const response = await saveRecipe(request({
      locale: "fr",
      mode: "update",
      slug: "tarte-mobile",
      expectedRevision: 3,
      recipePayload: JSON.stringify({ ...payload, referenceServings: 51 }),
    }) as never);
    expect(response.status).toBe(400);
    expect(fetchMutation).not.toHaveBeenCalled();
  });

  test("image routes return typed successful revision responses", async () => {
    fetchMutation
      .mockResolvedValueOnce({ slug: "tarte-mobile", revision: 4, savedAt: 1234 })
      .mockResolvedValueOnce({
        slug: "tarte-mobile",
        heroImageUrl: "https://images.example/photo.jpg",
        revision: 5,
        savedAt: 2345,
      });

    const upload = await setHeroImage(request({
      slug: "tarte-mobile",
      storageId: "storage-id",
      expectedRevision: 3,
    }) as never);
    const unsplash = await setUnsplashImage(request({
      slug: "tarte-mobile",
      imageUrl: "https://images.example/photo.jpg",
      photographerName: "Maman",
      photographerUrl: "https://example.com/maman",
      photoUrl: "https://example.com/photo",
      expectedRevision: 4,
    }) as never);

    expect(await upload.json()).toMatchObject({ type: "success", revision: 4 });
    expect(await unsplash.json()).toMatchObject({ type: "success", revision: 5 });
  });

  test("save and image routes expose typed revision conflicts", async () => {
    fetchMutation.mockRejectedValue(new Error("RECIPE_DRAFT_CONFLICT:7"));
    const saveResponse = await saveRecipe(request({ locale: "fr", mode: "update", slug: "tarte-mobile", expectedRevision: 3, recipePayload: JSON.stringify(payload) }) as never);
    const uploadResponse = await setHeroImage(request({ slug: "tarte-mobile", storageId: "storage-id", expectedRevision: 3 }) as never);
    const unsplashResponse = await setUnsplashImage(request({ slug: "tarte-mobile", imageUrl: "https://images.example/photo.jpg", photographerName: "Maman", photographerUrl: "https://example.com/maman", photoUrl: "https://example.com/photo", expectedRevision: 3 }) as never);
    for (const response of [saveResponse, uploadResponse, unsplashResponse]) {
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ type: "conflict", latestRevision: 7 });
    }
  });

  test("Openverse image association exposes the same typed conflict", async () => {
    fetchMutation
      .mockResolvedValueOnce("https://upload.example/file")
      .mockRejectedValueOnce(new Error("RECIPE_DRAFT_CONFLICT:9"));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(new Blob(["image"], { type: "image/jpeg" }), { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(Response.json({ storageId: "storage-id" })));
    const response = await setOpenverseImage(request({ slug: "tarte-mobile", imageUrl: "https://images.example/photo.jpg", expectedRevision: 3 }) as never);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ type: "conflict", latestRevision: 9 });
    vi.unstubAllGlobals();
  });

  test("discard returns the restored draft and publication revisions", async () => {
    fetchMutation.mockResolvedValue({ slug: "tarte-mobile", revision: 5, publishedRevision: 5, savedAt: 2345, draft: payload });
    const response = await discardRecipe(request({ slug: "tarte-mobile", expectedRevision: 4 }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ revision: 5, publishedRevision: 5, draft: { translations: { fr: { title: "Tarte mobile" } } } });
  });

  test("publish validates input, returns revisions, and exposes typed blockers", async () => {
    expect((await publishRecipe(request({ slug: "tarte-mobile" }) as never)).status).toBe(400);
    fetchMutation.mockResolvedValueOnce({ slug: "tarte-mobile", revision: 5, publishedRevision: 5, savedAt: 3456 });
    const success = await publishRecipe(request({ slug: "tarte-mobile", expectedRevision: 5 }) as never);
    expect(await success.json()).toMatchObject({ type: "success", revision: 5, publishedRevision: 5, savedAt: 3456 });
    fetchMutation.mockRejectedValueOnce(new Error("RECIPE_NOT_READY"));
    expect((await publishRecipe(request({ slug: "tarte-mobile", expectedRevision: 5 }) as never)).status).toBe(400);
  });

  test("unpublish has an explicit success contract", async () => {
    fetchMutation.mockResolvedValue({ slug: "tarte-mobile" });
    const response = await unpublishRecipe(request({ slug: "tarte-mobile" }) as never);
    expect(await response.json()).toEqual({ type: "success", slug: "tarte-mobile" });
  });

  test("delete validates revisions and returns a typed success contract", async () => {
    expect((await deleteRecipe(request({ slug: "tarte-mobile" }) as never)).status).toBe(400);
    fetchMutation.mockResolvedValueOnce({ slug: "tarte-mobile" });
    const success = await deleteRecipe(request({ slug: "tarte-mobile", expectedRevision: 5 }) as never);
    expect(await success.json()).toEqual({ type: "success", slug: "tarte-mobile" });
    expect(revalidateRecipePaths).toHaveBeenCalledWith("tarte-mobile");

    fetchMutation.mockRejectedValueOnce(new Error("RECIPE_DRAFT_CONFLICT:7"));
    const conflict = await deleteRecipe(request({ slug: "tarte-mobile", expectedRevision: 5 }) as never);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ type: "conflict", latestRevision: 7 });
  });
});
