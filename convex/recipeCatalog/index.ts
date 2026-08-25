import { rawRecipeCatalog } from "./rawCatalog";
import { loadCatalogSources, type CatalogRecipeSource } from "./validation";

export const recipeCatalog = loadCatalogSources(rawRecipeCatalog);

export type CatalogRecipe = CatalogRecipeSource;

export function selectCatalogRecipes(slug?: string) {
  if (!slug) return recipeCatalog;
  const recipe = recipeCatalog.find((candidate) => candidate.slug === slug);
  if (!recipe) throw new Error("RECIPE_NOT_FOUND");
  return [recipe];
}
