import type { RecipeDraftPayload } from "./recipe-form-schema";
import type { EditableRecipe } from "./types";

export function toFormValues(recipe: EditableRecipe): RecipeDraftPayload {
  return cloneRecipe({
    defaultLocale: recipe.defaultLocale,
    referenceServings: recipe.referenceServings,
    relatedRecipeSlugs: recipe.relatedRecipeSlugs,
    translations: recipe.translations,
    categories: recipe.categories,
    legacyCategoryLabels: recipe.legacyCategoryLabels,
  });
}

export function cloneRecipe(recipe: RecipeDraftPayload): RecipeDraftPayload {
  return structuredClone(recipe);
}
