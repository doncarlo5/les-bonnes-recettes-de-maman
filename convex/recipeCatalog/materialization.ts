import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  assertRecipeDraftBytes,
  assertRecipeDraftBounds,
  assertRecipeImageLimits,
} from "../../lib/recipe-admin-domain";
import {
  resolveRecipeCategories,
  toLegacyTags,
} from "../../lib/recipe-categories";
import { deleteRecipeRecord } from "../recipeDeletion";
import { recipeCatalog, type CatalogRecipe } from "./index";

type RecipeDoc = Doc<"recipes">;
type RecipeDraftDoc = Doc<"recipeDrafts">;

type CatalogSyncResult = {
  inserted: number;
  updated: number;
  total: number;
};

type FullCatalogSyncResult = CatalogSyncResult & { removed: number };

type SeedCatalogRequest = { slug?: string; publish: false };
type TargetedCatalogSyncRequest = { slug: string; publish: true };
type FullCatalogSyncRequest = { slug?: undefined; publish: true };
type CatalogMaterializationRequest =
  | SeedCatalogRequest
  | TargetedCatalogSyncRequest
  | FullCatalogSyncRequest;

const referenceServingsResetSlugs = new Set([
  "amandin",
  "banana-bread-du-kona-inn",
  "cake-au-chevre-et-courgettes",
  "cake-chevre-noix-olives",
  "cake-moelleux-au-citron-de-pierre-herme",
  "cake-orange",
  "clafoutis-poires-et-framboises",
  "coulants-au-chocolat",
  "crumble-aux-pommes-du-verger",
  "flan-au-lait-concentre-sucre-nestle",
  "gateau-au-chocolat",
  "gateau-aux-pommes",
  "pain-de-poisson",
  "tarte-aux-amandes-et-confiture-de-framboises",
  "tiramisu",
  "vacherin",
  "veloute-de-courgettes",
]);

const categoryResetSlugs = new Set([
  "osso-buco",
  "pate-feuilletee-maman",
  "vacherin",
]);

const obsoleteRecipeSlugs = ["moka"] as const;

const storedRecipeCatalog = recipeCatalog.map(toStoredCatalogRecipe);
type StoredCatalogRecipe = (typeof storedRecipeCatalog)[number];

export function materializeRecipeCatalog(
  ctx: MutationCtx,
  request: SeedCatalogRequest,
): Promise<CatalogSyncResult>;
export function materializeRecipeCatalog(
  ctx: MutationCtx,
  request: TargetedCatalogSyncRequest,
): Promise<CatalogSyncResult>;
export function materializeRecipeCatalog(
  ctx: MutationCtx,
  request: FullCatalogSyncRequest,
): Promise<FullCatalogSyncResult>;
export async function materializeRecipeCatalog(
  ctx: MutationCtx,
  request: CatalogMaterializationRequest,
): Promise<CatalogSyncResult | FullCatalogSyncResult> {
  const selectedRecipes = selectStoredCatalogRecipes(request.slug);
  const result = await synchronizeCatalogRecipes(
    ctx,
    selectedRecipes,
    request.publish,
  );

  if (!request.publish || request.slug) return result;

  const removals = await Promise.all(
    obsoleteRecipeSlugs.map((slug) => deleteRecipeRecord(ctx, slug)),
  );
  return {
    ...result,
    removed: removals.filter(Boolean).length,
  };
}

function selectStoredCatalogRecipes(slug?: string) {
  if (!slug) return storedRecipeCatalog;
  const recipe = storedRecipeCatalog.find(
    (candidate) => candidate.slug === slug,
  );
  if (!recipe) throw new Error("RECIPE_NOT_FOUND");
  return [recipe];
}

async function synchronizeCatalogRecipes(
  ctx: MutationCtx,
  selectedRecipes: readonly StoredCatalogRecipe[],
  publish: boolean,
) {
  const changes = await Promise.all(
    selectedRecipes.map((recipe) =>
      synchronizeCatalogRecipe(ctx, recipe, publish),
    ),
  );

  return {
    inserted: changes.filter((change) => change === "inserted").length,
    updated: changes.filter((change) => change === "updated").length,
    total: selectedRecipes.length,
  };
}

async function synchronizeCatalogRecipe(
  ctx: MutationCtx,
  recipe: StoredCatalogRecipe,
  publish: boolean,
) {
  const existing = await ctx.db
    .query("recipes")
    .withIndex("by_slug", (q) => q.eq("slug", recipe.slug))
    .unique();

  if (!existing) {
    assertRecipeDraftBytes(recipe);
    await ctx.db.insert("recipes", recipe);
    return "inserted" as const;
  }

  const draft = await getRecipeDraft(ctx, existing._id);
  const source = draft ?? existing;
  const resetReferenceServings =
    publish || referenceServingsResetSlugs.has(recipe.slug);
  const referenceServings = resetReferenceServings
    ? recipe.referenceServings
    : (source.referenceServings ?? recipe.referenceServings);
  const resetCategories = publish || categoryResetSlugs.has(recipe.slug);
  const categoryFields = resolveRecipeCategories(
    resetCategories
      ? {
          categories: recipe.categories,
          legacyCategoryLabels: recipe.legacyCategoryLabels,
        }
      : {
          categories: recipe.categories,
          legacyCategoryLabels: [
            ...recipe.legacyCategoryLabels,
            ...(source.legacyCategoryLabels ?? []),
          ],
          tags: source.tags,
        },
  );
  const seededContent = {
    defaultLocale: recipe.defaultLocale,
    relatedRecipeSlugs: recipe.relatedRecipeSlugs,
    translations: recipe.translations,
    ...categoryFields,
    tags: toLegacyTags(
      categoryFields.categories,
      categoryFields.legacyCategoryLabels,
    ),
    ...(referenceServings !== undefined ? { referenceServings } : {}),
  };
  const publishedPatch = {
    heroImageStorageId: source.heroImageStorageId,
    heroImageUrl: source.heroImageUrl,
    imageCredit: source.imageCredit,
    defaultLocale: recipe.defaultLocale,
    referenceServings,
    relatedRecipeSlugs: recipe.relatedRecipeSlugs,
    translations: recipe.translations,
    ...categoryFields,
    tags: toLegacyTags(
      categoryFields.categories,
      categoryFields.legacyCategoryLabels,
    ),
    status: "published" as const,
  };
  if (
    publish &&
    matchesPublishedRecipe(existing, publishedPatch) &&
    (!draft || matchesPublishedDraft(draft, publishedPatch))
  ) {
    return "unchanged" as const;
  }

  const revision = (draft?.revision ?? 0) + 1;
  const updatedAt = Date.now();
  const nextDraft = {
    recipeId: existing._id,
    heroImageUrl: source.heroImageUrl,
    ...(source.heroImageStorageId
      ? { heroImageStorageId: source.heroImageStorageId }
      : {}),
    ...(source.imageCredit ? { imageCredit: source.imageCredit } : {}),
    ...seededContent,
    revision,
    publishedRevision: publish
      ? revision
      : (draft?.publishedRevision ??
        (existing.status === "published" ? 0 : -1)),
    updatedAt,
  };

  assertMaterializedDraft(recipe, nextDraft);
  if (publish) {
    assertRecipeDraftBytes({ ...existing, ...publishedPatch });
    await ctx.db.patch(existing._id, publishedPatch);
  }
  if (draft) await ctx.db.replace(draft._id, nextDraft);
  else await ctx.db.insert("recipeDrafts", nextDraft);
  return "updated" as const;
}

function toStoredCatalogRecipe(source: CatalogRecipe) {
  return {
    ...source,
    translations: {
      fr: toStoredLocalizedRecipe(source.translations.fr),
      en: toStoredLocalizedRecipe(source.translations.en),
    },
    tags: toLegacyTags(source.categories, source.legacyCategoryLabels),
    status: "published" as const,
  };
}

function toStoredLocalizedRecipe(
  localized: CatalogRecipe["translations"]["fr"],
) {
  return {
    ...localized,
    sections: localized.sections.map((section) => ({
      title: section.title,
      steps: section.steps.map((step) => step.text),
      stepDetails: section.steps,
    })),
    servings: null,
  };
}

function matchesPublishedRecipe(
  recipe: RecipeDoc,
  expected: Pick<
    RecipeDoc,
    | "heroImageStorageId"
    | "heroImageUrl"
    | "imageCredit"
    | "defaultLocale"
    | "referenceServings"
    | "relatedRecipeSlugs"
    | "translations"
    | "categories"
    | "legacyCategoryLabels"
    | "tags"
    | "status"
  >,
) {
  return sameJson(
    {
      heroImageStorageId: recipe.heroImageStorageId,
      heroImageUrl: recipe.heroImageUrl,
      imageCredit: recipe.imageCredit,
      defaultLocale: recipe.defaultLocale,
      referenceServings: recipe.referenceServings,
      relatedRecipeSlugs: recipe.relatedRecipeSlugs,
      translations: recipe.translations,
      categories: recipe.categories,
      legacyCategoryLabels: recipe.legacyCategoryLabels,
      tags: recipe.tags,
      status: recipe.status,
    },
    expected,
  );
}

function matchesPublishedDraft(
  draft: RecipeDraftDoc,
  expected: Pick<
    RecipeDoc,
    | "heroImageStorageId"
    | "heroImageUrl"
    | "imageCredit"
    | "defaultLocale"
    | "referenceServings"
    | "relatedRecipeSlugs"
    | "translations"
    | "categories"
    | "legacyCategoryLabels"
    | "tags"
  >,
) {
  const {
    heroImageStorageId,
    heroImageUrl,
    imageCredit,
    defaultLocale,
    referenceServings,
    relatedRecipeSlugs,
    translations,
    categories,
    legacyCategoryLabels,
    tags,
  } = expected;
  return (
    draft.revision === draft.publishedRevision &&
    sameJson(
      {
        heroImageStorageId: draft.heroImageStorageId,
        heroImageUrl: draft.heroImageUrl,
        imageCredit: draft.imageCredit,
        defaultLocale: draft.defaultLocale,
        referenceServings: draft.referenceServings,
        relatedRecipeSlugs: draft.relatedRecipeSlugs,
        translations: draft.translations,
        categories: draft.categories,
        legacyCategoryLabels: draft.legacyCategoryLabels,
        tags: draft.tags,
      },
      {
        heroImageStorageId,
        heroImageUrl,
        imageCredit,
        defaultLocale,
        referenceServings,
        relatedRecipeSlugs,
        translations,
        categories,
        legacyCategoryLabels,
        tags,
      },
    )
  );
}

function assertMaterializedDraft(
  recipe: StoredCatalogRecipe,
  draft: {
    referenceServings?: number;
    relatedRecipeSlugs: string[];
    categories: StoredCatalogRecipe["categories"];
    legacyCategoryLabels: string[];
    heroImageUrl: string;
    imageCredit?: RecipeDraftDoc["imageCredit"];
    [key: string]: unknown;
  },
) {
  assertRecipeDraftBounds({
    ...recipe,
    referenceServings: draft.referenceServings,
    relatedRecipeSlugs: draft.relatedRecipeSlugs,
    categories: draft.categories,
    legacyCategoryLabels: draft.legacyCategoryLabels,
  });
  assertRecipeImageLimits(draft.heroImageUrl, draft.imageCredit);
  assertRecipeDraftBytes(draft);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

async function getRecipeDraft(
  ctx: MutationCtx,
  recipeId: Doc<"recipes">["_id"],
) {
  return await ctx.db
    .query("recipeDrafts")
    .withIndex("by_recipeId", (q) => q.eq("recipeId", recipeId))
    .unique();
}
