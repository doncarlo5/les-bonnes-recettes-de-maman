import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { backfillYieldLabels } from "../lib/recipe-yield";
import { resolveReferenceServings } from "../lib/recipe-servings";
import { resolveRecipeCategories } from "../lib/recipe-categories";
import { backfillLocalizedStepIngredients } from "../lib/recipe-step-migration";

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

export const backfillRecipeCategories = migrations.define({
  table: "recipes",
  migrateOne: (_ctx, recipe) => {
    const resolved = resolveRecipeCategories(recipe);
    return sameCategoryFields(recipe, resolved) ? undefined : resolved;
  },
});

export const backfillDraftCategories = migrations.define({
  table: "recipeDrafts",
  migrateOne: (_ctx, draft) => {
    const resolved = resolveRecipeCategories(draft);
    return sameCategoryFields(draft, resolved) ? undefined : resolved;
  },
});

export const runCategoryBackfill = migrations.runner([
  internal.migrations.backfillRecipeCategories,
  internal.migrations.backfillDraftCategories,
]);

export const backfillRecipeStepIngredients = migrations.define({
  table: "recipes",
  migrateOne: (_ctx, recipe) => {
    const fr = backfillLocalizedStepIngredients(recipe.translations.fr);
    const en = backfillLocalizedStepIngredients(recipe.translations.en);
    return fr === recipe.translations.fr && en === recipe.translations.en
      ? undefined
      : { translations: { fr, en } };
  },
});

export const backfillDraftStepIngredients = migrations.define({
  table: "recipeDrafts",
  migrateOne: (_ctx, draft) => {
    const fr = backfillLocalizedStepIngredients(draft.translations.fr);
    const en = backfillLocalizedStepIngredients(draft.translations.en);
    return fr === draft.translations.fr && en === draft.translations.en
      ? undefined
      : { translations: { fr, en } };
  },
});

export const runStepIngredientBackfill = migrations.runner([
  internal.migrations.backfillRecipeStepIngredients,
  internal.migrations.backfillDraftStepIngredients,
]);

export const run = migrations.runner();

function sameCategoryFields(
  source: { categories?: readonly string[]; legacyCategoryLabels?: readonly string[] },
  resolved: { categories: readonly string[]; legacyCategoryLabels: readonly string[] },
) {
  return JSON.stringify(source.categories ?? []) === JSON.stringify(resolved.categories)
    && JSON.stringify(source.legacyCategoryLabels ?? []) === JSON.stringify(resolved.legacyCategoryLabels);
}
