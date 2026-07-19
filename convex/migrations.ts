import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { backfillYieldLabels } from "../lib/recipe-yield";

export const migrations = new Migrations<DataModel>(components.migrations);

export const backfillRecipeYieldLabels = migrations.define({
  table: "recipes",
  migrateOne: (_ctx, recipe) => {
    const translations = backfillYieldLabels(recipe.slug, recipe.translations);
    return translations === recipe.translations ? undefined : { translations };
  },
});

export const backfillDraftYieldLabels = migrations.define({
  table: "recipeDrafts",
  migrateOne: async (ctx, draft) => {
    const recipe = await ctx.db.get(draft.recipeId);
    if (!recipe) return;
    const translations = backfillYieldLabels(recipe.slug, draft.translations);
    return translations === draft.translations ? undefined : { translations };
  },
});

export const runYieldLabelBackfill = migrations.runner([
  internal.migrations.backfillRecipeYieldLabels,
  internal.migrations.backfillDraftYieldLabels,
]);

export const run = migrations.runner();
