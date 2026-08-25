import { z } from "zod";
import {
  assertRecipeDraftLimits,
  getRecipeStepReferenceIssues,
} from "../../lib/recipe-admin-domain";
import { RECIPE_CATEGORIES, toLegacyTags } from "../../lib/recipe-categories";
import { rawRecipeCatalog } from "./rawCatalog";

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
  servings: z
    .strictObject({ quantity: z.number(), unit: z.string() })
    .nullable(),
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

function compileCatalogRecipe(source: CatalogRecipeSource) {
  return {
    ...source,
    translations: {
      fr: compileLocalizedRecipe(source.translations.fr),
      en: compileLocalizedRecipe(source.translations.en),
    },
    tags: toLegacyTags(source.categories, source.legacyCategoryLabels),
    status: "published" as const,
  };
}

function compileLocalizedRecipe(
  localized: CatalogRecipeSource["translations"]["fr"],
) {
  return {
    ...localized,
    sections: localized.sections.map((section) => ({
      title: section.title,
      steps: section.steps.map((step) => step.text),
      stepDetails: section.steps,
    })),
  };
}

function loadCatalog() {
  const sources = rawRecipeCatalog.map(([expectedSlug, rawRecipe]) => {
    const source = catalogRecipeSchema.parse(rawRecipe);
    if (source.slug !== expectedSlug) {
      throw new Error(
        `Catalog file slug ${expectedSlug} contains recipe ${source.slug}`,
      );
    }
    return source;
  });
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

  return sources.map(compileCatalogRecipe);
}

export const recipeCatalog = loadCatalog();

export type CatalogRecipe = (typeof recipeCatalog)[number];

export function selectCatalogRecipes(slug?: string) {
  if (!slug) return recipeCatalog;
  const recipe = recipeCatalog.find((candidate) => candidate.slug === slug);
  if (!recipe) throw new Error("RECIPE_NOT_FOUND");
  return [recipe];
}
