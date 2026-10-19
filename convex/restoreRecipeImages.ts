import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import originals from "../assets/recipe-posters/original-images.json";

// Restricted, revision-checked restoration from the recorded pre-poster images.
// No recipe content or storage files are removed by this operation.
export const restore = internalMutation({
  args: { slug: v.string(), expectedRevision: v.number() },
  handler: async (ctx, { slug, expectedRevision }) => {
    const original = originals.find((entry) => entry.slug === slug);
    if (!original) throw new Error("RESTORATION_NOT_RECORDED");
    const recipe = await ctx.db.query("recipes").withIndex("by_slug", q => q.eq("slug", slug)).unique();
    if (!recipe || recipe.status !== "published") throw new Error("RECIPE_NOT_PUBLISHED");
    const draft = await ctx.db.query("recipeDrafts").withIndex("by_recipeId", q => q.eq("recipeId", recipe._id)).unique();
    if (!draft || draft.revision !== expectedRevision || draft.revision !== draft.publishedRevision) throw new Error("RECIPE_DRAFT_CONFLICT");
    const currentUrl = recipe.heroImageStorageId ? await ctx.storage.getUrl(recipe.heroImageStorageId) : recipe.heroImageUrl;
    if (currentUrl === original.url) return { slug, restored: false };
    if (currentUrl !== original.expectedImageUrl) throw new Error("RECIPE_IMAGE_CHANGED");
    const image = { heroImageUrl: original.url, heroImageStorageId: undefined,
      imageCredit: (original.credit ?? undefined) as Doc<"recipes">["imageCredit"] };
    await ctx.db.patch(recipe._id, image);
    await ctx.db.patch(draft._id, { ...image, revision: draft.revision + 1, publishedRevision: draft.revision + 1, updatedAt: Date.now() });
    return { slug, restored: true };
  },
});
