import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { backfillYieldLabels } from "../lib/recipe-yield";
import { resolveReferenceServings } from "../lib/recipe-servings";

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

export const backfillRecipeReferenceServings = migrations.define({
  table: "recipes",
  migrateOne: (_ctx, recipe) => {
    const referenceServings = resolveReferenceServings(
      recipe.referenceServings,
      recipe.translations.fr.servings,
    );
    return recipe.referenceServings === undefined && referenceServings !== undefined
      ? { referenceServings }
      : undefined;
  },
});

export const backfillDraftReferenceServings = migrations.define({
  table: "recipeDrafts",
  migrateOne: (_ctx, draft) => {
    const referenceServings = resolveReferenceServings(
      draft.referenceServings,
      draft.translations.fr.servings,
    );
    return draft.referenceServings === undefined && referenceServings !== undefined
      ? { referenceServings }
      : undefined;
  },
});

export const runReferenceServingsBackfill = migrations.runner([
  internal.migrations.backfillRecipeReferenceServings,
  internal.migrations.backfillDraftReferenceServings,
]);

export const run = migrations.runner();
