/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { recipeCatalog } from "./recipeCatalog";
import originals from "../assets/recipe-posters/original-images.json";
const modules = import.meta.glob("./**/*.ts");

test("restoration changes only images, preserves credits and rejects concurrent edits", async () => {
  const t = convexTest(schema, modules);
  const source = recipeCatalog.find(r => r.slug === "amandin")!;
  const original = originals.find(r => r.slug === "amandin")!;
  const created = await t.mutation(api.recipes.create, { adminPassword: "test-password", recipe: {
    defaultLocale: source.defaultLocale, categories: source.categories,
    translations: source.translations, relatedRecipeSlugs: [],
  } });
  await t.run(async ctx => {
    await ctx.db.patch(created.recipeId, { status: "published", heroImageUrl: original.expectedImageUrl });
    const draft = await ctx.db.query("recipeDrafts").withIndex("by_recipeId", q => q.eq("recipeId", created.recipeId)).unique();
    await ctx.db.patch(draft!._id, { heroImageUrl: original.expectedImageUrl, publishedRevision: 0 });
  });
  const before = await t.run(ctx => ctx.db.get(created.recipeId));
  await expect(t.mutation(internal.restoreRecipeImages.restore, { slug: created.slug, expectedRevision: 1 })).rejects.toThrow("RECIPE_DRAFT_CONFLICT");
  await t.mutation(internal.restoreRecipeImages.restore, { slug: created.slug, expectedRevision: 0 });
  expect(await t.run(ctx => ctx.db.get(created.recipeId))).toEqual({ ...before, heroImageUrl: original.url, imageCredit: original.credit });
  const editing = await t.query(api.recipes.getForEditing, { slug: created.slug, locale: "fr", adminPassword: "test-password" });
  expect(editing?.hasUnpublishedChanges).toBe(false);
  expect(editing?.revision).toBe(1);
});
