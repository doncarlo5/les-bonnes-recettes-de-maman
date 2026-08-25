import { rawRecipeCatalog } from "./rawCatalog";
import { loadCatalogSources, type CatalogRecipeSource } from "./validation";

export const recipeCatalog = loadCatalogSources(rawRecipeCatalog);

export type CatalogRecipe = CatalogRecipeSource;
