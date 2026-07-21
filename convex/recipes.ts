import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import rawRecipes from "./recettes.json";
import { toSeedRecipe, type SourceRecipe } from "./recipeTranslations";
import {
  assertRecipeDraftBytes,
  assertRecipeDraftLimits,
  getPublicationState,
  getRecipeReadiness,
  RECIPE_FIELD_LIMITS,
  type RecipeDraftContentLike,
} from "../lib/recipe-admin-domain";
import { resolveYieldLabel } from "../lib/recipe-yield";
import { resolveReferenceServings } from "../lib/recipe-servings";
import {
  RECIPE_CATEGORIES,
  resolveRecipeCategories,
  toLegacyTags,
  type RecipeCategory,
} from "../lib/recipe-categories";
import { legacyIngredientId, legacyStepId } from "../lib/recipe-item-ids";

declare const process: {
  env: {
    RECIPE_ADMIN_PASSWORD?: string;
  };
};

const localeValidator = v.union(v.literal("fr"), v.literal("en"));
const recipeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const recipeCategoryValidator = v.union(
  v.literal("dessert"),
  v.literal("plat"),
  v.literal("sucre"),
  v.literal("sale"),
);

type Locale = "fr" | "en";
type RecipeDoc = Doc<"recipes">;
type RecipeDraftDoc = Doc<"recipeDrafts">;

const ingredientValidator = v.object({
  id: v.string(),
  name: v.string(),
  quantity: v.string(),
  unit: v.string(),
  notes: v.string(),
});

const stepIngredientUseValidator = v.object({
  ingredientId: v.string(),
  amount: v.optional(v.object({ quantity: v.string(), unit: v.string() })),
});

const recipeStepValidator = v.object({
  id: v.string(),
  text: v.string(),
  ingredientUses: v.array(stepIngredientUseValidator),
});

const sectionValidator = v.object({
  title: v.string(),
  steps: v.array(recipeStepValidator),
});

const subRecipeValidator = v.object({
  title: v.string(),
  ingredients: v.array(ingredientValidator),
});

const localizedRecipeValidator = v.object({
  title: v.string(),
  author: v.string(),
  description: v.string(),
  servings: v.union(
    v.object({
      quantity: v.number(),
      unit: v.string(),
    }),
    v.null(),
  ),
  yieldLabel: v.optional(v.string()),
  prepTime: v.string(),
  cookTime: v.string(),
  restTime: v.optional(v.string()),
  totalTime: v.string(),
  timeLabel: v.string(),
  temperature: v.string(),
  equipment: v.optional(v.array(v.string())),
  ingredients: v.array(ingredientValidator),
  sections: v.array(sectionValidator),
  subRecipes: v.array(subRecipeValidator),
  notes: v.array(v.string()),
});

const editableLocalizedRecipeValidator = v.object({
  title: v.string(),
  author: v.string(),
  description: v.string(),
  yieldLabel: v.string(),
  prepTime: v.string(),
  cookTime: v.string(),
  restTime: v.optional(v.string()),
  totalTime: v.string(),
  timeLabel: v.string(),
  temperature: v.string(),
  equipment: v.optional(v.array(v.string())),
  ingredients: v.array(ingredientValidator),
  sections: v.array(sectionValidator),
  subRecipes: v.array(subRecipeValidator),
  notes: v.array(v.string()),
});

const canonicalDraftContentValidator = v.object({
  defaultLocale: localeValidator,
  referenceServings: v.optional(v.number()),
  relatedRecipeSlugs: v.optional(v.array(v.string())),
  translations: v.object({
    fr: editableLocalizedRecipeValidator,
    en: editableLocalizedRecipeValidator,
  }),
  categories: v.array(recipeCategoryValidator),
  legacyCategoryLabels: v.optional(v.array(v.string())),
});

const legacyDraftContentValidator = v.object({
  defaultLocale: localeValidator,
  referenceServings: v.optional(v.number()),
  relatedRecipeSlugs: v.optional(v.array(v.string())),
  translations: v.object({
    fr: editableLocalizedRecipeValidator,
    en: editableLocalizedRecipeValidator,
  }),
  tags: v.array(v.string()),
});

const draftContentValidator = v.union(
  canonicalDraftContentValidator,
  legacyDraftContentValidator,
);

const openverseImageCreditValidator = v.object({
  title: v.string(),
  creator: v.string(),
  creatorUrl: v.string(),
  imageUrl: v.string(),
  landingUrl: v.string(),
  license: v.string(),
  licenseVersion: v.string(),
  licenseUrl: v.string(),
  source: v.string(),
  attribution: v.string(),
  alt: v.string(),
});

const recipes = (rawRecipes as SourceRecipe[]).map(toSeedRecipe);
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

export const list = query({
  args: {
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const publishedRecipes = await ctx.db
      .query("recipes")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .paginate(args.paginationOpts);

    const localizedRecipes = await Promise.all(
      publishedRecipes.page.map((recipe) =>
        localizeSummary(ctx, recipe, args.locale),
      ),
    );

    return { ...publishedRecipes, page: localizedRecipes };
  },
});

export const listSlugs = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("recipes")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((recipe) => ({ slug: recipe.slug })),
    };
  },
});

export const getBySlug = query({
  args: {
    locale: localeValidator,
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!recipe || recipe.status !== "published") {
      return null;
    }

    return localize(ctx, recipe, args.locale);
  },
});

export const listForEditing = query({
  args: {
    locale: localeValidator,
    adminPassword: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const editableRecipes = await ctx.db
      .query("recipes")
      .order("desc")
      .paginate(args.paginationOpts);

    const localized = await Promise.all(
      editableRecipes.page.map(async (recipe) => {
        const draft = await getRecipeDraft(ctx, recipe._id);
        const source = draft ?? recipe;
        const storedHeroImageUrl = source.heroImageStorageId
          ? await ctx.storage.getUrl(source.heroImageStorageId)
          : null;
        const revision = draft?.revision ?? 0;
        const publishedRevision =
          draft?.publishedRevision ?? (recipe.status === "published" ? 0 : -1);
        const publication = getPublicationState(
          recipe.status,
          revision,
          publishedRevision,
        );
        const hasImage = Boolean(storedHeroImageUrl ?? source.heroImageUrl);

        return {
          _id: recipe._id,
          _creationTime: recipe._creationTime,
          slug: recipe.slug,
          title: source.translations[args.locale].title,
          heroImageUrl: storedHeroImageUrl ?? source.heroImageUrl,
          imageCredit: source.imageCredit,
          ...resolveRecipeCategories(source),
          status: recipe.status,
          revision,
          publishedRevision,
          updatedAt: draft?.updatedAt ?? recipe._creationTime,
          ...publication,
          readiness: getRecipeReadiness(
            toEditableRecipeContent(source, recipe.slug),
            hasImage,
          ),
        };
      }),
    );

    return { ...editableRecipes, page: localized };
  },
});

export const getForEditing = query({
  args: {
    slug: v.string(),
    locale: localeValidator,
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const recipe = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!recipe) return null;

    const draft = await getRecipeDraft(ctx, recipe._id);
    const source = draft ?? recipe;
    const storedHeroImageUrl = source.heroImageStorageId
      ? await ctx.storage.getUrl(source.heroImageStorageId)
      : null;
    const revision = draft?.revision ?? 0;
    const publishedRevision =
      draft?.publishedRevision ?? (recipe.status === "published" ? 0 : -1);
    const publication = getPublicationState(
      recipe.status,
      revision,
      publishedRevision,
    );

    return {
      _id: recipe._id,
      _creationTime: recipe._creationTime,
      slug: recipe.slug,
      title: source.translations[args.locale].title,
      heroImageUrl: storedHeroImageUrl ?? source.heroImageUrl,
      imageCredit: source.imageCredit,
      defaultLocale: source.defaultLocale,
      referenceServings: getReferenceServings(source),
      relatedRecipeSlugs: source.relatedRecipeSlugs ?? [],
      translations: toEditableTranslations(source.translations, recipe.slug),
      ...resolveRecipeCategories(source),
      status: recipe.status,
      revision,
      publishedRevision,
      updatedAt: draft?.updatedAt ?? recipe._creationTime,
      ...publication,
      readiness: getRecipeReadiness(
        toEditableRecipeContent(source, recipe.slug),
        Boolean(storedHeroImageUrl ?? source.heroImageUrl),
      ),
    };
  },
});

export const create = mutation({
  args: {
    recipe: draftContentValidator,
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const normalizedRecipe = normalizeCategoryPayload(args.recipe);
    assertRecipeBounds(normalizedRecipe);

    const title = normalizedRecipe.translations.fr.title.trim();
    const baseSlug = slugify(title || "nouvelle-recette");
    const slug = await getAvailableSlug(ctx, baseSlug);
    assertNoSelfRelatedRecipe(slug, normalizedRecipe.relatedRecipeSlugs);

    const storedTranslations = toStoredTranslations(
      normalizedRecipe.translations,
    );
    const initialRecipe = {
      slug,
      heroImageUrl: "",
      defaultLocale: normalizedRecipe.defaultLocale,
      referenceServings: normalizedRecipe.referenceServings,
      relatedRecipeSlugs: normalizedRecipe.relatedRecipeSlugs,
      translations: storedTranslations,
      ...toStoredCategoryFields(normalizedRecipe),
      status: "draft",
    } as const;
    assertStoredRecipeBytes(initialRecipe);
    const recipeId = await ctx.db.insert("recipes", initialRecipe);

    const now = Date.now();
    const initialDraft = {
      recipeId,
      heroImageUrl: "",
      defaultLocale: normalizedRecipe.defaultLocale,
      referenceServings: normalizedRecipe.referenceServings,
      relatedRecipeSlugs: normalizedRecipe.relatedRecipeSlugs,
      translations: storedTranslations,
      ...toStoredCategoryFields(normalizedRecipe),
      revision: 0,
      publishedRevision: -1,
      updatedAt: now,
    };
    assertProspectiveDraft(initialDraft, slug);
    await ctx.db.insert("recipeDrafts", initialDraft);

    return {
      recipeId,
      slug,
      title: title || "Nouvelle recette",
      revision: 0,
      publishedRevision: -1,
      savedAt: now,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDraft = mutation({
  args: {
    slug: v.string(),
    recipe: draftContentValidator,
    expectedRevision: v.number(),
    force: v.optional(v.boolean()),
    preserveStepIngredientUses: v.optional(v.boolean()),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const normalizedRecipe = normalizeCategoryPayload(args.recipe);

    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!existing) {
      throw new Error("RECIPE_NOT_FOUND");
    }
    assertNoSelfRelatedRecipe(
      existing.slug,
      normalizedRecipe.relatedRecipeSlugs,
    );

    const currentDraft = await getRecipeDraft(ctx, existing._id);
    const currentRevision = currentDraft?.revision ?? 0;

    if (!args.force && args.expectedRevision !== currentRevision) {
      throw new Error(`RECIPE_DRAFT_CONFLICT:${currentRevision}`);
    }

    const revision = currentRevision + 1;
    const savedAt = Date.now();
    const effectiveRecipe = args.preserveStepIngredientUses
      ? {
          ...normalizedRecipe,
          translations: mergeLegacyStepMetadata(
            normalizedRecipe.translations,
            toEditableTranslations(
              (currentDraft ?? existing).translations,
              existing.slug,
            ),
          ),
        }
      : normalizedRecipe;
    assertRecipeBounds(effectiveRecipe);

    const storedTranslations = toStoredTranslations(
      effectiveRecipe.translations,
      currentDraft?.translations ?? existing.translations,
    );
    const contentPatch = {
      defaultLocale: effectiveRecipe.defaultLocale,
      referenceServings: effectiveRecipe.referenceServings,
      relatedRecipeSlugs: effectiveRecipe.relatedRecipeSlugs,
      translations: storedTranslations,
      ...toStoredCategoryFields(effectiveRecipe),
      revision,
      updatedAt: savedAt,
    };
    if (currentDraft) {
      assertProspectiveDraft(
        { ...currentDraft, ...contentPatch },
        existing.slug,
      );
      await ctx.db.patch(currentDraft._id, contentPatch);
    } else {
      const initialDraft = {
        recipeId: existing._id,
        heroImageStorageId: existing.heroImageStorageId,
        heroImageUrl: existing.heroImageUrl,
        imageCredit: existing.imageCredit,
        defaultLocale: normalizedRecipe.defaultLocale,
        referenceServings: normalizedRecipe.referenceServings,
        relatedRecipeSlugs: normalizedRecipe.relatedRecipeSlugs,
        translations: storedTranslations,
        ...toStoredCategoryFields(normalizedRecipe),
        revision,
        publishedRevision: existing.status === "published" ? 0 : -1,
        updatedAt: savedAt,
      };
      assertProspectiveDraft(initialDraft, existing.slug);
      await ctx.db.insert("recipeDrafts", initialDraft);
    }

    return {
      recipeId: existing._id,
      slug: existing.slug,
      title: args.recipe.translations[args.recipe.defaultLocale].title,
      revision,
      savedAt,
    };
  },
});

export const publishDraft = mutation({
  args: {
    slug: v.string(),
    expectedRevision: v.number(),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const recipe = await getRecipeBySlug(ctx, args.slug);
    const draft = await getRecipeDraft(ctx, recipe._id);

    if (!draft) throw new Error("RECIPE_DRAFT_NOT_FOUND");
    if (draft.revision !== args.expectedRevision) {
      throw new Error(`RECIPE_DRAFT_CONFLICT:${draft.revision}`);
    }
    assertRecipeBounds(toEditableRecipeContent(draft, recipe.slug));
    assertDraftReadyForPublication(draft, recipe.slug);
    const relatedRecipeSlugs = normalizeRelatedRecipeSlugs(
      draft.relatedRecipeSlugs ?? [],
    );
    await assertRelatedRecipesPublishable(ctx, recipe.slug, relatedRecipeSlugs);

    const publishedPatch = {
      heroImageStorageId: draft.heroImageStorageId,
      heroImageUrl: draft.heroImageUrl,
      imageCredit: draft.imageCredit,
      defaultLocale: draft.defaultLocale,
      referenceServings: draft.referenceServings,
      relatedRecipeSlugs,
      translations: draft.translations,
      ...toStoredCategoryFields(resolveRecipeCategories(draft)),
      status: "published",
    } as const;
    assertStoredRecipeBytes({ ...recipe, ...publishedPatch });
    await ctx.db.patch(recipe._id, publishedPatch);
    const savedAt = Date.now();
    assertProspectiveDraft(
      { ...draft, publishedRevision: draft.revision, updatedAt: savedAt },
      recipe.slug,
    );
    await ctx.db.patch(draft._id, {
      relatedRecipeSlugs,
      publishedRevision: draft.revision,
      updatedAt: savedAt,
    });
    await deleteStorageIfOrphaned(
      ctx,
      recipe.heroImageStorageId,
      draft.heroImageStorageId,
    );

    return {
      slug: recipe.slug,
      revision: draft.revision,
      publishedRevision: draft.revision,
      savedAt,
    };
  },
});

export const discardDraft = mutation({
  args: {
    slug: v.string(),
    expectedRevision: v.number(),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const recipe = await getRecipeBySlug(ctx, args.slug);
    const draft = await getRecipeDraft(ctx, recipe._id);

    if (!draft) throw new Error("RECIPE_DRAFT_NOT_FOUND");
    if (draft.revision !== args.expectedRevision) {
      throw new Error(`RECIPE_DRAFT_CONFLICT:${draft.revision}`);
    }
    if (draft.publishedRevision < 0)
      throw new Error("RECIPE_HAS_NO_PUBLISHED_VERSION");
    const revision = draft.revision + 1;
    const savedAt = Date.now();
    const restoredPatch = {
      heroImageStorageId: recipe.heroImageStorageId,
      heroImageUrl: recipe.heroImageUrl,
      imageCredit: recipe.imageCredit,
      defaultLocale: recipe.defaultLocale,
      referenceServings: recipe.referenceServings,
      relatedRecipeSlugs: recipe.relatedRecipeSlugs,
      translations: recipe.translations,
      ...toStoredCategoryFields(resolveRecipeCategories(recipe)),
      revision,
      publishedRevision: revision,
      updatedAt: savedAt,
    };
    assertProspectiveDraft({ ...draft, ...restoredPatch }, recipe.slug);
    await ctx.db.patch(draft._id, restoredPatch);
    await deleteStorageIfOrphaned(
      ctx,
      draft.heroImageStorageId,
      recipe.heroImageStorageId,
    );

    return {
      slug: recipe.slug,
      revision,
      publishedRevision: revision,
      savedAt,
      draft: {
        defaultLocale: recipe.defaultLocale,
        referenceServings: getReferenceServings(recipe),
        relatedRecipeSlugs: recipe.relatedRecipeSlugs ?? [],
        translations: toEditableTranslations(recipe.translations, recipe.slug),
        ...resolveRecipeCategories(recipe),
      },
    };
  },
});

export const unpublish = mutation({
  args: { slug: v.string(), adminPassword: v.string() },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const recipe = await getRecipeBySlug(ctx, args.slug);
    await ensureRecipeDraft(ctx, recipe);
    assertStoredRecipeBytes({ ...recipe, status: "draft" });
    await ctx.db.patch(recipe._id, { status: "draft" });
    return { slug: recipe.slug };
  },
});

export const deleteRecipe = mutation({
  args: {
    slug: v.string(),
    expectedRevision: v.number(),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const recipe = await getRecipeBySlug(ctx, args.slug);
    const draft = await getRecipeDraft(ctx, recipe._id);
    const currentRevision = draft?.revision ?? 0;
    if (args.expectedRevision !== currentRevision) {
      throw new Error(`RECIPE_DRAFT_CONFLICT:${currentRevision}`);
    }

    await removeRecipeBySlugIfPresent(ctx, recipe.slug);

    return { slug: recipe.slug };
  },
});

export const setHeroImage = mutation({
  args: {
    slug: v.string(),
    storageId: v.id("_storage"),
    expectedRevision: v.number(),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    const [recipe, storedImage] = await Promise.all([
      getRecipeBySlug(ctx, args.slug),
      ctx.db.system.get(args.storageId),
    ]);

    if (!storedImage) {
      throw new Error("Image was not found in Convex Storage");
    }

    const saved = await updateDraftImage(ctx, recipe, args.expectedRevision, {
      heroImageStorageId: args.storageId,
      heroImageUrl: "",
      imageCredit: undefined,
    });

    return imageMutationSnapshot(
      ctx,
      recipe.slug,
      args.storageId,
      "",
      undefined,
      saved,
    );
  },
});

export const setUnsplashHeroImage = mutation({
  args: {
    slug: v.string(),
    imageUrl: v.string(),
    alt: v.string(),
    photographerName: v.string(),
    photographerUrl: v.string(),
    photoUrl: v.string(),
    expectedRevision: v.number(),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    const recipe = await getRecipeBySlug(ctx, args.slug);
    const saved = await updateDraftImage(ctx, recipe, args.expectedRevision, {
      heroImageStorageId: undefined,
      heroImageUrl: args.imageUrl,
      imageCredit: {
        provider: "unsplash",
        photographerName: args.photographerName,
        photographerUrl: args.photographerUrl,
        photoUrl: args.photoUrl,
        alt: args.alt,
      },
    });

    return imageMutationSnapshot(
      ctx,
      recipe.slug,
      undefined,
      args.imageUrl,
      {
        provider: "unsplash" as const,
        photographerName: args.photographerName,
        photographerUrl: args.photographerUrl,
        photoUrl: args.photoUrl,
        alt: args.alt,
      },
      saved,
    );
  },
});

export const setOpenverseHeroImage = mutation({
  args: {
    slug: v.string(),
    storageId: v.id("_storage"),
    imageCredit: openverseImageCreditValidator,
    expectedRevision: v.number(),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    const [recipe, storedImage] = await Promise.all([
      getRecipeBySlug(ctx, args.slug),
      ctx.db.system.get(args.storageId),
    ]);

    if (!storedImage) {
      throw new Error("Image was not found in Convex Storage");
    }

    const saved = await updateDraftImage(ctx, recipe, args.expectedRevision, {
      heroImageStorageId: args.storageId,
      heroImageUrl: "",
      imageCredit: {
        provider: "openverse",
        ...args.imageCredit,
      },
    });

    return imageMutationSnapshot(
      ctx,
      recipe.slug,
      args.storageId,
      "",
      {
        provider: "openverse" as const,
        ...args.imageCredit,
      },
      saved,
    );
  },
});

export const cleanupHeroImageUpload = mutation({
  args: {
    slug: v.string(),
    storageId: v.id("_storage"),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const recipe = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    const draft = recipe ? await getRecipeDraft(ctx, recipe._id) : null;
    const source =
      draft?.heroImageStorageId === args.storageId
        ? draft
        : recipe?.heroImageStorageId === args.storageId
          ? recipe
          : null;
    if (source) {
      const heroImageUrl = await ctx.storage.getUrl(args.storageId);
      return {
        referenced: true,
        slug: recipe?.slug ?? args.slug,
        revision: draft?.revision ?? 0,
        savedAt: draft?.updatedAt ?? recipe?._creationTime ?? Date.now(),
        heroImageUrl: heroImageUrl ?? source.heroImageUrl,
        imageCredit: source.imageCredit,
      };
    }
    const [referencingRecipe, referencingDraft] = await Promise.all([
      ctx.db
        .query("recipes")
        .withIndex("by_heroImageStorageId", (q) =>
          q.eq("heroImageStorageId", args.storageId),
        )
        .first(),
      ctx.db
        .query("recipeDrafts")
        .withIndex("by_heroImageStorageId", (q) =>
          q.eq("heroImageStorageId", args.storageId),
        )
        .first(),
    ]);
    const globalSource = referencingDraft ?? referencingRecipe;
    if (globalSource) {
      const ownerRecipe = referencingDraft
        ? await ctx.db.get(referencingDraft.recipeId)
        : referencingRecipe;
      const ownerDraft = referencingDraft
        ? referencingDraft
        : ownerRecipe
          ? await getRecipeDraft(ctx, ownerRecipe._id)
          : null;
      const heroImageUrl = await ctx.storage.getUrl(args.storageId);
      return {
        referenced: true,
        slug: ownerRecipe?.slug ?? args.slug,
        revision: ownerDraft?.revision ?? 0,
        savedAt:
          ownerDraft?.updatedAt ?? ownerRecipe?._creationTime ?? Date.now(),
        heroImageUrl: heroImageUrl ?? globalSource.heroImageUrl,
        imageCredit: globalSource.imageCredit,
      };
    }
    await deleteStorageIfOrphaned(ctx, args.storageId);
    return { referenced: false, slug: args.slug };
  },
});

export const seed = mutation({
  args: {
    adminPassword: v.string(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    const selectedRecipes = args.slug
      ? recipes.filter((recipe) => recipe.slug === args.slug)
      : recipes;
    if (args.slug && selectedRecipes.length === 0) {
      throw new Error("RECIPE_NOT_FOUND");
    }

    return syncSeedRecipes(ctx, selectedRecipes, false);
  },
});

export const syncProduction = mutation({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const [result, removals] = await Promise.all([
      syncSeedRecipes(ctx, recipes, true),
      Promise.all(
        obsoleteRecipeSlugs.map((slug) =>
          removeRecipeBySlugIfPresent(ctx, slug),
        ),
      ),
    ]);
    const removed = removals.filter(Boolean).length;
    return { ...result, removed };
  },
});

async function syncSeedRecipes(
  ctx: MutationCtx,
  selectedRecipes: typeof recipes,
  publish: boolean,
) {
  const changes = await Promise.all(
    selectedRecipes.map(async (recipe) => {
      const existing = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", recipe.slug))
        .unique();

      if (!existing) {
        assertStoredRecipeBytes(recipe);
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
        matchesPublishedSeed(existing, publishedPatch) &&
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

      assertProspectiveDraft(nextDraft, existing.slug);
      if (publish) {
        assertStoredRecipeBytes({ ...existing, ...publishedPatch });
        await ctx.db.patch(existing._id, publishedPatch);
      }
      if (draft) await ctx.db.replace(draft._id, nextDraft);
      else await ctx.db.insert("recipeDrafts", nextDraft);
      return "updated" as const;
    }),
  );

  return {
    inserted: changes.filter((change) => change === "inserted").length,
    updated: changes.filter((change) => change === "updated").length,
    total: selectedRecipes.length,
  };
}

function matchesPublishedSeed(
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

async function removeRecipeBySlugIfPresent(ctx: MutationCtx, slug: string) {
  const recipe = await ctx.db
    .query("recipes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!recipe) return false;

  const draft = await getRecipeDraft(ctx, recipe._id);
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

async function localize(ctx: QueryCtx, recipe: RecipeDoc, locale: Locale) {
  if (!recipe.translations || !recipe.defaultLocale) {
    throw new Error(`Recipe ${recipe.slug} has not been migrated`);
  }

  const translation = recipe.translations[locale];
  const { servings, yieldLabel, ...content } = translation;
  const publicContent = toEditableLocalizedRecipe(
    translation,
    locale,
    recipe.slug,
  );
  const storedHeroImageUrl = recipe.heroImageStorageId
    ? await ctx.storage.getUrl(recipe.heroImageStorageId)
    : null;
  const relatedRecipes = (
    await Promise.all(
      [...new Set(recipe.relatedRecipeSlugs ?? [])]
        .filter((slug) => slug !== recipe.slug)
        .slice(0, 20)
        .map(async (slug) => {
          const related = await ctx.db
            .query("recipes")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique();
          if (!related || related.status !== "published") return null;
          return {
            slug: related.slug,
            title: related.translations[locale].title,
          };
        }),
    )
  ).filter((item): item is { slug: string; title: string } => item !== null);

  return {
    _id: recipe._id,
    _creationTime: recipe._creationTime,
    slug: recipe.slug,
    heroImageUrl: storedHeroImageUrl ?? recipe.heroImageUrl,
    ...((!storedHeroImageUrl || recipe.imageCredit?.provider === "openverse") &&
    recipe.imageCredit
      ? { imageCredit: recipe.imageCredit }
      : {}),
    defaultLocale: recipe.defaultLocale,
    referenceServings: getReferenceServings(recipe),
    relatedRecipes,
    ...resolveRecipeCategories(recipe),
    status: recipe.status,
    ...publicContent,
    // Rollout 1 remains additive: old clients keep reading string steps while
    // new clients prefer stepDetails. Rollout 2 can make stepDetails canonical.
    sections: content.sections.map((section, sectionIndex) => ({
      title: section.title,
      steps: section.steps,
      stepDetails: publicContent.sections[sectionIndex]?.steps ?? [],
    })),
    restTime: content.restTime ?? "",
    equipment: content.equipment ?? [],
    yieldLabel: resolveYieldLabel({
      locale,
      slug: recipe.slug,
      yieldLabel,
      servings,
    }),
  };
}

async function localizeSummary(
  ctx: QueryCtx,
  recipe: RecipeDoc,
  locale: Locale,
) {
  const translation = recipe.translations[locale];
  const storedHeroImageUrl = recipe.heroImageStorageId
    ? await ctx.storage.getUrl(recipe.heroImageStorageId)
    : null;
  return {
    _id: recipe._id,
    _creationTime: recipe._creationTime,
    slug: recipe.slug,
    heroImageUrl: storedHeroImageUrl ?? recipe.heroImageUrl,
    ...resolveRecipeCategories(recipe),
    title: translation.title,
    author: translation.author,
    description: translation.description,
    prepTime: translation.prepTime,
    cookTime: translation.cookTime,
    timeLabel: translation.timeLabel,
    ingredients: translation.ingredients.map(({ name }) => ({ name })),
  };
}

function getReferenceServings(
  source: Pick<
    RecipeDoc | RecipeDraftDoc,
    "referenceServings" | "translations"
  >,
) {
  return resolveReferenceServings(
    source.referenceServings,
    source.translations.fr.servings,
  );
}

type StoredLocalizedRecipe = RecipeDoc["translations"][Locale];
type EditableLocalizedRecipe = Omit<
  StoredLocalizedRecipe,
  | "servings"
  | "yieldLabel"
  | "restTime"
  | "equipment"
  | "ingredients"
  | "sections"
  | "subRecipes"
> & {
  yieldLabel: string;
  restTime: string;
  equipment: string[];
  ingredients: Array<
    StoredLocalizedRecipe["ingredients"][number] & { id: string }
  >;
  sections: Array<{
    title: string;
    steps: Array<{
      id: string;
      text: string;
      ingredientUses: Array<{
        ingredientId: string;
        amount?: { quantity: string; unit: string };
      }>;
    }>;
  }>;
  subRecipes: Array<{
    title: string;
    ingredients: Array<
      StoredLocalizedRecipe["ingredients"][number] & { id: string }
    >;
  }>;
};
type EditableTranslations = Record<Locale, EditableLocalizedRecipe>;

function toEditableTranslations(
  translations: RecipeDoc["translations"],
  slug: string,
): EditableTranslations {
  return {
    fr: toEditableLocalizedRecipe(translations.fr, "fr", slug),
    en: toEditableLocalizedRecipe(translations.en, "en", slug),
  };
}

function toEditableRecipeContent(
  source: Pick<
    RecipeDoc | RecipeDraftDoc,
    | "defaultLocale"
    | "referenceServings"
    | "relatedRecipeSlugs"
    | "translations"
    | "tags"
    | "categories"
    | "legacyCategoryLabels"
  >,
  slug: string,
): RecipeDraftContentLike {
  return {
    defaultLocale: source.defaultLocale,
    referenceServings: getReferenceServings(source),
    relatedRecipeSlugs: source.relatedRecipeSlugs ?? [],
    translations: toEditableTranslations(source.translations, slug),
    ...resolveRecipeCategories(source),
  };
}

function toEditableLocalizedRecipe(
  localized: StoredLocalizedRecipe,
  locale: Locale,
  slug: string,
): EditableLocalizedRecipe {
  const { servings, yieldLabel, ...content } = localized;
  return {
    ...content,
    ingredients: content.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: ingredient.id ?? legacyIngredientId("main", index),
    })),
    sections: content.sections.map((section, sectionIndex) => ({
      title: section.title,
      steps:
        section.stepDetails ??
        section.steps.map((text, stepIndex) => ({
          id: legacyStepId(sectionIndex, stepIndex),
          text,
          ingredientUses: [],
        })),
    })),
    subRecipes: content.subRecipes.map((subRecipe, subRecipeIndex) => ({
      ...subRecipe,
      ingredients: subRecipe.ingredients.map((ingredient, index) => ({
        ...ingredient,
        id: ingredient.id ?? legacyIngredientId(`sub-${subRecipeIndex}`, index),
      })),
    })),
    restTime: content.restTime ?? "",
    equipment: content.equipment ?? [],
    yieldLabel: resolveYieldLabel({ locale, slug, yieldLabel, servings }),
  };
}

function toStoredTranslations(
  translations: EditableTranslations,
  legacyTranslations?: RecipeDoc["translations"],
): RecipeDoc["translations"] {
  return {
    fr: toStoredLocalizedRecipe(
      translations.fr,
      legacyTranslations?.fr.servings,
    ),
    en: toStoredLocalizedRecipe(
      translations.en,
      legacyTranslations?.en.servings,
    ),
  };
}

function toStoredLocalizedRecipe(
  localized: EditableLocalizedRecipe,
  servings: StoredLocalizedRecipe["servings"] | undefined,
): StoredLocalizedRecipe {
  return {
    ...localized,
    sections: localized.sections.map((section) => ({
      title: section.title,
      steps: section.steps.map((step) => step.text),
      stepDetails: section.steps,
    })),
    restTime: localized.restTime ?? "",
    equipment: localized.equipment ?? [],
    servings: servings ?? null,
  };
}

function mergeLegacyStepMetadata(
  incoming: EditableTranslations,
  current: EditableTranslations,
): EditableTranslations {
  return {
    fr: mergeLegacyLocalizedStepMetadata(incoming.fr, current.fr),
    en: mergeLegacyLocalizedStepMetadata(incoming.en, current.en),
  };
}

function mergeLegacyLocalizedStepMetadata(
  incoming: EditableLocalizedRecipe,
  current: EditableLocalizedRecipe,
): EditableLocalizedRecipe {
  const mainIngredients = reconcileIngredientIds(
    incoming.ingredients,
    current.ingredients,
  );
  const subRecipes = incoming.subRecipes.map((subRecipe, subRecipeIndex) => ({
    ...subRecipe,
    ingredients: reconcileIngredientIds(
      subRecipe.ingredients,
      current.subRecipes[subRecipeIndex]?.ingredients ?? [],
    ),
  }));
  const validIngredientIds = new Set([
    ...mainIngredients.map((ingredient) => ingredient.id),
    ...subRecipes.flatMap((subRecipe) =>
      subRecipe.ingredients.map((ingredient) => ingredient.id),
    ),
  ]);
  return {
    ...incoming,
    ingredients: mainIngredients,
    subRecipes,
    sections: incoming.sections.map((section, sectionIndex) => ({
      ...section,
      steps: (() => {
        const currentSteps = current.sections[sectionIndex]?.steps ?? [];
        const available = new Set(currentSteps.map((_, index) => index));
        return section.steps.map((step, stepIndex) => {
          const matchingIndex = currentSteps.findIndex(
            (candidate, index) =>
              available.has(index) && candidate.text === step.text,
          );
          const fallbackIndex = available.has(stepIndex) ? stepIndex : -1;
          const previousIndex =
            matchingIndex >= 0 ? matchingIndex : fallbackIndex;
          const previous =
            previousIndex >= 0 ? currentSteps[previousIndex] : undefined;
          if (previousIndex >= 0) available.delete(previousIndex);
          return previous
            ? {
                ...step,
                id: previous.id,
                ingredientUses: previous.ingredientUses.filter((use) =>
                  validIngredientIds.has(use.ingredientId),
                ),
              }
            : step;
        });
      })(),
    })),
  };
}

function reconcileIngredientIds(
  incoming: EditableLocalizedRecipe["ingredients"],
  current: EditableLocalizedRecipe["ingredients"],
) {
  const available = new Set(current.map((_, index) => index));
  return incoming.map((ingredient, index) => {
    const matchingIndex = current.findIndex(
      (candidate, candidateIndex) =>
        available.has(candidateIndex) &&
        candidate.name === ingredient.name &&
        candidate.quantity === ingredient.quantity &&
        candidate.unit === ingredient.unit,
    );
    const fallbackIndex = available.has(index) ? index : -1;
    const currentIndex = matchingIndex >= 0 ? matchingIndex : fallbackIndex;
    if (currentIndex >= 0) available.delete(currentIndex);
    return {
      ...ingredient,
      id: currentIndex >= 0 ? current[currentIndex].id : ingredient.id,
    };
  });
}

async function getAvailableSlug(ctx: MutationCtx, baseSlug: string) {
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique()
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function getRecipeBySlug(ctx: MutationCtx, slug: string) {
  const recipe = await ctx.db
    .query("recipes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();

  if (!recipe) throw new Error("RECIPE_NOT_FOUND");
  return recipe;
}

async function getRecipeDraft(
  ctx: QueryCtx | MutationCtx,
  recipeId: Id<"recipes">,
) {
  return await ctx.db
    .query("recipeDrafts")
    .withIndex("by_recipeId", (q) => q.eq("recipeId", recipeId))
    .unique();
}

async function ensureRecipeDraft(ctx: MutationCtx, recipe: RecipeDoc) {
  const existing = await getRecipeDraft(ctx, recipe._id);
  if (existing) return existing;

  const initialDraft = {
    recipeId: recipe._id,
    heroImageStorageId: recipe.heroImageStorageId,
    heroImageUrl: recipe.heroImageUrl,
    imageCredit: recipe.imageCredit,
    defaultLocale: recipe.defaultLocale,
    referenceServings: recipe.referenceServings,
    relatedRecipeSlugs: recipe.relatedRecipeSlugs,
    translations: recipe.translations,
    ...toStoredCategoryFields(resolveRecipeCategories(recipe)),
    revision: 0,
    publishedRevision: recipe.status === "published" ? 0 : -1,
    updatedAt: Date.now(),
  };
  assertProspectiveDraft(initialDraft, recipe.slug);
  const draftId = await ctx.db.insert("recipeDrafts", initialDraft);

  const created = await ctx.db.get(draftId);
  if (!created) throw new Error("RECIPE_DRAFT_NOT_FOUND");
  return created;
}

type DraftImagePatch = Pick<
  RecipeDraftDoc,
  "heroImageStorageId" | "heroImageUrl" | "imageCredit"
>;

async function updateDraftImage(
  ctx: MutationCtx,
  recipe: RecipeDoc,
  expectedRevision: number,
  patch: DraftImagePatch,
) {
  const draft = await ensureRecipeDraft(ctx, recipe);
  assertExpectedRevision(draft, expectedRevision);
  assertImagePatchLimits(patch);
  const revision = draft.revision + 1;
  const savedAt = Date.now();
  assertRecipeDraftBytes({ ...draft, ...patch, revision, updatedAt: savedAt });
  const previousStorageId = draft.heroImageStorageId;
  await ctx.db.patch(draft._id, { ...patch, revision, updatedAt: savedAt });
  await deleteStorageIfOrphaned(
    ctx,
    previousStorageId,
    patch.heroImageStorageId,
    recipe.heroImageStorageId,
  );
  return { revision, savedAt };
}

async function imageMutationSnapshot(
  ctx: MutationCtx,
  slug: string,
  storageId: Id<"_storage"> | undefined,
  fallbackUrl: string,
  imageCredit: RecipeDraftDoc["imageCredit"],
  saved: { revision: number; savedAt: number },
) {
  const storedUrl = storageId ? await ctx.storage.getUrl(storageId) : null;
  return {
    slug,
    ...saved,
    heroImageUrl: storedUrl ?? fallbackUrl,
    imageCredit,
  };
}

async function deleteStorageIfOrphaned(
  ctx: MutationCtx,
  candidate: Id<"_storage"> | undefined,
  ...references: Array<Id<"_storage"> | undefined>
) {
  if (!candidate || references.includes(candidate)) return;
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
  if (await ctx.db.system.get("_storage", candidate))
    await ctx.storage.delete(candidate);
}

function assertImagePatchLimits(patch: DraftImagePatch) {
  if (patch.heroImageUrl.length > RECIPE_FIELD_LIMITS.url) {
    throw new Error("RECIPE_LIMIT_EXCEEDED");
  }
  if (!patch.imageCredit) return;
  for (const [key, value] of Object.entries(patch.imageCredit)) {
    if (key === "provider") continue;
    const maximum = key.toLowerCase().includes("url")
      ? RECIPE_FIELD_LIMITS.url
      : RECIPE_FIELD_LIMITS.creditText;
    if (value.length > maximum) throw new Error("RECIPE_LIMIT_EXCEEDED");
  }
}

function assertProspectiveDraft(
  draft: {
    defaultLocale: Locale;
    tags?: string[];
    categories?: RecipeCategory[];
    legacyCategoryLabels?: string[];
    relatedRecipeSlugs?: string[];
    translations: RecipeDoc["translations"];
    heroImageUrl?: string;
    imageCredit?: RecipeDraftDoc["imageCredit"];
    [key: string]: unknown;
  },
  slug: string,
) {
  assertRecipeBounds({
    ...draft,
    relatedRecipeSlugs: draft.relatedRecipeSlugs ?? [],
    ...resolveRecipeCategories(draft),
    translations: toEditableTranslations(draft.translations, slug),
  });
  assertImagePatchLimits({
    heroImageStorageId: undefined,
    heroImageUrl: draft.heroImageUrl ?? "",
    imageCredit: draft.imageCredit,
  });
  assertRecipeDraftBytes(draft);
}

function assertStoredRecipeBytes(recipe: unknown) {
  assertRecipeDraftBytes(recipe);
}

function assertExpectedRevision(
  draft: RecipeDraftDoc,
  expectedRevision: number,
) {
  if (expectedRevision !== draft.revision) {
    throw new Error(`RECIPE_DRAFT_CONFLICT:${draft.revision}`);
  }
}

function assertDraftReadyForPublication(draft: RecipeDraftDoc, slug: string) {
  if (
    getRecipeReadiness(
      toEditableRecipeContent(draft, slug),
      Boolean(draft.heroImageStorageId || draft.heroImageUrl),
    ).blockers.length
  ) {
    throw new Error("RECIPE_NOT_READY");
  }
}

function assertRecipeBounds(recipe: RecipeDraftContentLike) {
  assertRecipeDraftLimits(recipe);
  if (
    recipe.categories.length > RECIPE_CATEGORIES.length ||
    (recipe.legacyCategoryLabels?.length ?? 0) > 50
  ) {
    throw new Error("RECIPE_LIMIT_EXCEEDED");
  }
  for (const localized of Object.values(recipe.translations)) {
    if (
      localized.ingredients.length > 200 ||
      localized.equipment.length > 50 ||
      localized.sections.length > 50 ||
      localized.subRecipes.length > 25 ||
      localized.notes.length > 100 ||
      localized.sections.some((section) => section.steps.length > 100) ||
      localized.sections.some((section) =>
        section.steps.some(
          (step) =>
            typeof step !== "string" && step.ingredientUses.length > 200,
        ),
      ) ||
      localized.subRecipes.some(
        (subRecipe) => subRecipe.ingredients.length > 100,
      )
    ) {
      throw new Error("RECIPE_LIMIT_EXCEEDED");
    }
  }
  if (recipe.relatedRecipeSlugs.length > 20) {
    throw new Error("RECIPE_LIMIT_EXCEEDED");
  }
  assertRecipeDraftBytes(recipe);
}

function toStoredCategoryFields(source: {
  categories: readonly RecipeCategory[];
  legacyCategoryLabels?: readonly string[];
}) {
  const categories = [...source.categories];
  const legacyCategoryLabels = [...(source.legacyCategoryLabels ?? [])];
  return {
    categories,
    legacyCategoryLabels,
    tags: toLegacyTags(categories, legacyCategoryLabels),
  };
}

function normalizeCategoryPayload<
  T extends {
    tags?: readonly string[];
    categories?: readonly RecipeCategory[];
    legacyCategoryLabels?: readonly string[];
    relatedRecipeSlugs?: readonly string[];
    translations: Record<
      Locale,
      { restTime?: string; equipment?: readonly string[] }
    >;
  },
>(source: T) {
  return {
    ...source,
    relatedRecipeSlugs: normalizeRelatedRecipeSlugs(
      source.relatedRecipeSlugs ?? [],
    ),
    translations: {
      fr: {
        ...source.translations.fr,
        restTime: source.translations.fr.restTime ?? "",
        equipment: [...(source.translations.fr.equipment ?? [])],
      },
      en: {
        ...source.translations.en,
        restTime: source.translations.en.restTime ?? "",
        equipment: [...(source.translations.en.equipment ?? [])],
      },
    },
    ...resolveRecipeCategories(source),
  };
}

function normalizeRelatedRecipeSlugs(values: readonly string[]) {
  const slugs = [
    ...new Set(
      values.flatMap((value) => {
        const slug = value.trim();
        return slug ? [slug] : [];
      }),
    ),
  ];
  if (slugs.some((slug) => !recipeSlugPattern.test(slug))) {
    throw new Error("RECIPE_RELATED_RECIPE_INVALID");
  }
  return slugs;
}

function assertNoSelfRelatedRecipe(
  slug: string,
  relatedSlugs: readonly string[],
) {
  if (relatedSlugs.includes(slug)) {
    throw new Error("RECIPE_RELATED_RECIPE_SELF_REFERENCE");
  }
}

async function assertRelatedRecipesPublishable(
  ctx: MutationCtx,
  recipeSlug: string,
  relatedSlugs: readonly string[],
) {
  assertNoSelfRelatedRecipe(recipeSlug, relatedSlugs);
  const relations = await Promise.all(
    relatedSlugs.map(async (slug) => ({
      slug,
      recipe: await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique(),
    })),
  );
  const invalid = relations.find(
    ({ recipe }) => !recipe || recipe.status !== "published",
  );
  if (invalid) {
    throw new Error(`RECIPE_RELATED_RECIPE_NOT_FOUND:${invalid.slug}`);
  }
}

function assertRecipeAdminPassword(adminPassword: string) {
  const expectedPassword = process.env.RECIPE_ADMIN_PASSWORD;

  if (!expectedPassword || adminPassword !== expectedPassword) {
    throw new Error("RECIPE_ADMIN_REQUIRED");
  }
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "nouvelle-recette";
}
