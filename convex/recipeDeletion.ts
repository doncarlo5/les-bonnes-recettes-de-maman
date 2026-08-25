import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { detachLinkedIdea } from "./recipeIdeas";

export async function deleteRecipeRecord(ctx: MutationCtx, slug: string) {
  const recipe = await ctx.db
    .query("recipes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!recipe) return false;

  await detachLinkedIdea(ctx, recipe._id);
  const draft = await ctx.db
    .query("recipeDrafts")
    .withIndex("by_recipeId", (q) => q.eq("recipeId", recipe._id))
    .unique();
  const storageIds = new Set(
    [recipe.heroImageStorageId, draft?.heroImageStorageId].filter(
      (storageId): storageId is Id<"_storage"> => storageId !== undefined,
    ),
  );
  if (draft) await ctx.db.delete(draft._id);
  await ctx.db.delete(recipe._id);
  await Promise.all(
    [...storageIds].map((storageId) => deleteStorageIfOrphaned(ctx, storageId)),
  );
  await ctx.scheduler.runAfter(
    0,
    internal.commentMaintenance.cleanupRecipeComments,
    { recipeId: recipe._id },
  );
  return true;
}

async function deleteStorageIfOrphaned(
  ctx: MutationCtx,
  candidate: Id<"_storage">,
) {
  const [recipeReference, draftReference] = await Promise.all([
    ctx.db
      .query("recipes")
      .withIndex("by_heroImageStorageId", (q) =>
        q.eq("heroImageStorageId", candidate),
      )
      .first(),
    ctx.db
      .query("recipeDrafts")
      .withIndex("by_heroImageStorageId", (q) =>
        q.eq("heroImageStorageId", candidate),
      )
      .first(),
  ]);
  if (recipeReference || draftReference) return;
  if (await ctx.db.system.get("_storage", candidate)) {
    await ctx.storage.delete(candidate);
  }
}
