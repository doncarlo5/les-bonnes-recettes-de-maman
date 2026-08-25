import { z } from "zod";
import {
  assertRecipeDraftLimits,
  getRecipeStepReferenceIssues,
} from "../../lib/recipe-admin-domain";
import { RECIPE_CATEGORIES } from "../../lib/recipe-categories";

const recipeSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const ingredientSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string(),
  quantity: z.string(),
  unit: z.string(),
  notes: z.string(),
});

const ingredientUseSchema = z.strictObject({
  ingredientId: z.string().min(1),
  amount: z.strictObject({ quantity: z.string(), unit: z.string() }).optional(),
});

const recipeStepSchema = z.strictObject({
  id: z.string().min(1),
  text: z.string(),
  ingredientUses: z.array(ingredientUseSchema),
});

const localizedRecipeSchema = z.strictObject({
  title: z.string(),
  author: z.string(),
  description: z.string(),
  yieldLabel: z.string(),
  prepTime: z.string(),
  cookTime: z.string(),
  restTime: z.string(),
  totalTime: z.string(),
  timeLabel: z.string(),
  temperature: z.string(),
  equipment: z.array(z.string()),
  ingredients: z.array(ingredientSchema),
  sections: z.array(
    z.strictObject({
      title: z.string(),
      steps: z.array(recipeStepSchema),
    }),
  ),
  subRecipes: z.array(
    z.strictObject({
      title: z.string(),
      ingredients: z.array(ingredientSchema),
    }),
  ),
  notes: z.array(z.string()),
});

const catalogRecipeSchema = z.strictObject({
  slug: recipeSlugSchema,
  heroImageUrl: z.string(),
  defaultLocale: z.enum(["fr", "en"]),
  referenceServings: z.number().int().positive().optional(),
  relatedRecipeSlugs: z.array(recipeSlugSchema),
  categories: z.array(z.enum(RECIPE_CATEGORIES)),
  legacyCategoryLabels: z.array(z.string()),
  translations: z.strictObject({
    fr: localizedRecipeSchema,
    en: localizedRecipeSchema,
  }),
});

export type CatalogRecipeSource = z.infer<typeof catalogRecipeSchema>;

type RawCatalogEntry = {
  readonly sourcePath: string;
  readonly recipe: unknown;
};

type RawCatalogIndex = Readonly<Record<string, RawCatalogEntry>>;

export function loadCatalogSources(entries: RawCatalogIndex) {
  const sources = Object.entries(entries).map(
    ([indexSlug, { sourcePath, recipe }]) => {
      recipeSlugSchema.parse(indexSlug);
      const filenameMatch = sourcePath.match(/\/([^/]+)\.json$/);
      if (!filenameMatch) {
        throw new Error(`Invalid catalog recipe path: ${sourcePath}`);
      }
      const source = catalogRecipeSchema.parse(recipe);
      const filenameSlug = filenameMatch[1];
      if (indexSlug !== filenameSlug) {
        throw new Error(
          `Catalog index slug ${indexSlug} does not match file slug ${filenameSlug}`,
        );
      }
      if (source.slug !== indexSlug) {
        throw new Error(
          `Catalog index slug ${indexSlug} contains recipe ${source.slug}`,
        );
      }
      return source;
    },
  );
  const slugs = new Set<string>();

  for (const source of sources) {
    if (slugs.has(source.slug)) {
      throw new Error(`Duplicate catalog recipe slug: ${source.slug}`);
    }
    slugs.add(source.slug);
    assertRecipeDraftLimits(source);
    const referenceIssues = getRecipeStepReferenceIssues(source);
    if (referenceIssues.length > 0) {
      throw new Error(
        `Invalid step ingredient references for ${source.slug}: ${JSON.stringify(referenceIssues)}`,
      );
    }
  }

  for (const source of sources) {
    for (const relatedSlug of source.relatedRecipeSlugs) {
      if (relatedSlug === source.slug) {
        throw new Error(
          `Catalog recipe cannot relate to itself: ${source.slug}`,
        );
      }
      if (!slugs.has(relatedSlug)) {
        throw new Error(
          `Unknown related recipe ${relatedSlug} in catalog recipe ${source.slug}`,
        );
      }
    }
  }

  return sources;
}
