import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
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

declare const process: {
  env: {
    RECIPE_ADMIN_PASSWORD?: string;
  };
};

const localeValidator = v.union(v.literal("fr"), v.literal("en"));

type Locale = "fr" | "en";
type RecipeDoc = Doc<"recipes">;
type RecipeDraftDoc = Doc<"recipeDrafts">;

const ingredientValidator = v.object({
  name: v.string(),
  quantity: v.string(),
  unit: v.string(),
  notes: v.string(),
});

const sectionValidator = v.object({
  title: v.string(),
  steps: v.array(v.string()),
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
  totalTime: v.string(),
  timeLabel: v.string(),
  temperature: v.string(),
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
  totalTime: v.string(),
  timeLabel: v.string(),
  temperature: v.string(),
  ingredients: v.array(ingredientValidator),
  sections: v.array(sectionValidator),
  subRecipes: v.array(subRecipeValidator),
  notes: v.array(v.string()),
});

const editableRecipeValidator = v.object({
  defaultLocale: localeValidator,
  referenceServings: v.optional(v.number()),
  translations: v.object({
    fr: editableLocalizedRecipeValidator,
    en: editableLocalizedRecipeValidator,
  }),
  tags: v.array(v.string()),
  status: v.union(v.literal("draft"), v.literal("published")),
});

const draftContentValidator = v.object({
  defaultLocale: localeValidator,
  referenceServings: v.optional(v.number()),
  translations: v.object({
    fr: editableLocalizedRecipeValidator,
    en: editableLocalizedRecipeValidator,
  }),
  tags: v.array(v.string()),
});

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

export const list = query({
  args: {
    locale: localeValidator,
  },
  handler: async (ctx, args) => {
    const publishedRecipes = await ctx.db
      .query("recipes")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    const localizedRecipes = await Promise.all(
      publishedRecipes.map((recipe) => localize(ctx, recipe, args.locale)),
    );

    return localizedRecipes.sort((a, b) =>
      a.title.localeCompare(b.title, args.locale),
    );
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
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const editableRecipes = await ctx.db
      .query("recipes")
      .order("desc")
      .take(200);

    const localized = await Promise.all(
      editableRecipes.map(async (recipe) => {
        const draft = await getRecipeDraft(ctx, recipe._id);
        const source = draft ?? recipe;
        const storedHeroImageUrl = source.heroImageStorageId
          ? await ctx.storage.getUrl(source.heroImageStorageId)
          : null;
        const revision = draft?.revision ?? 0;
        const publishedRevision =
          draft?.publishedRevision ?? (recipe.status === "published" ? 0 : -1);
        const publication = getPublicationState(recipe.status, revision, publishedRevision);
        const hasImage = Boolean(storedHeroImageUrl ?? source.heroImageUrl);

        return {
          _id: recipe._id,
          _creationTime: recipe._creationTime,
          slug: recipe.slug,
          title: source.translations[args.locale].title,
          heroImageUrl: storedHeroImageUrl ?? source.heroImageUrl,
          imageCredit: source.imageCredit,
          tags: source.tags,
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

    return localized.sort((a, b) => b.updatedAt - a.updatedAt);
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
    const publication = getPublicationState(recipe.status, revision, publishedRevision);

    return {
      _id: recipe._id,
      _creationTime: recipe._creationTime,
      slug: recipe.slug,
      title: source.translations[args.locale].title,
      heroImageUrl: storedHeroImageUrl ?? source.heroImageUrl,
      imageCredit: source.imageCredit,
      defaultLocale: source.defaultLocale,
      referenceServings: getReferenceServings(source),
      translations: toEditableTranslations(source.translations, recipe.slug),
      tags: source.tags,
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
    recipe: editableRecipeValidator,
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    assertRecipeBounds(args.recipe);

    const title = args.recipe.translations.fr.title.trim();
    const baseSlug = slugify(title || "nouvelle-recette");
    const slug = await getAvailableSlug(ctx, baseSlug);

    const storedTranslations = toStoredTranslations(args.recipe.translations);
    const recipeId = await ctx.db.insert("recipes", {
      slug,
      heroImageUrl: "",
      defaultLocale: args.recipe.defaultLocale,
      referenceServings: args.recipe.referenceServings,
      translations: storedTranslations,
      tags: args.recipe.tags,
      status: "draft",
    });

    const now = Date.now();
    const initialDraft = {
      recipeId,
      heroImageUrl: "",
      defaultLocale: args.recipe.defaultLocale,
      referenceServings: args.recipe.referenceServings,
      translations: storedTranslations,
      tags: args.recipe.tags,
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
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    assertRecipeBounds(args.recipe);

    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!existing) {
      throw new Error("RECIPE_NOT_FOUND");
    }

    const currentDraft = await getRecipeDraft(ctx, existing._id);
    const currentRevision = currentDraft?.revision ?? 0;

    if (!args.force && args.expectedRevision !== currentRevision) {
      throw new Error(`RECIPE_DRAFT_CONFLICT:${currentRevision}`);
    }

    const revision = currentRevision + 1;
    const savedAt = Date.now();

    const storedTranslations = toStoredTranslations(
      args.recipe.translations,
      currentDraft?.translations ?? existing.translations,
    );
    const contentPatch = {
        defaultLocale: args.recipe.defaultLocale,
        referenceServings: args.recipe.referenceServings,
        translations: storedTranslations,
        tags: args.recipe.tags,
        revision,
        updatedAt: savedAt,
    };
    if (currentDraft) {
      assertProspectiveDraft({ ...currentDraft, ...contentPatch }, existing.slug);
      await ctx.db.patch(currentDraft._id, contentPatch);
    } else {
      const initialDraft = {
        recipeId: existing._id,
        heroImageStorageId: existing.heroImageStorageId,
        heroImageUrl: existing.heroImageUrl,
        imageCredit: existing.imageCredit,
        defaultLocale: args.recipe.defaultLocale,
        referenceServings: args.recipe.referenceServings,
        translations: storedTranslations,
        tags: args.recipe.tags,
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

    await ctx.db.patch(recipe._id, {
      heroImageStorageId: draft.heroImageStorageId,
      heroImageUrl: draft.heroImageUrl,
      imageCredit: draft.imageCredit,
      defaultLocale: draft.defaultLocale,
      referenceServings: draft.referenceServings,
      translations: draft.translations,
      tags: draft.tags,
      status: "published",
    });
    const savedAt = Date.now();
    assertProspectiveDraft(
      { ...draft, publishedRevision: draft.revision, updatedAt: savedAt },
      recipe.slug,
    );
    await ctx.db.patch(draft._id, {
      publishedRevision: draft.revision,
      updatedAt: savedAt,
    });

    return { slug: recipe.slug, revision: draft.revision, publishedRevision: draft.revision, savedAt };
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
    if (draft.publishedRevision < 0) throw new Error("RECIPE_HAS_NO_PUBLISHED_VERSION");
    const revision = draft.revision + 1;
    const savedAt = Date.now();
    const restoredPatch = {
      heroImageStorageId: recipe.heroImageStorageId,
      heroImageUrl: recipe.heroImageUrl,
      imageCredit: recipe.imageCredit,
      defaultLocale: recipe.defaultLocale,
      referenceServings: recipe.referenceServings,
      translations: recipe.translations,
      tags: recipe.tags,
      revision,
      publishedRevision: revision,
      updatedAt: savedAt,
    };
    assertProspectiveDraft({ ...draft, ...restoredPatch }, recipe.slug);
    await ctx.db.patch(draft._id, restoredPatch);

    return {
      slug: recipe.slug,
      revision,
      publishedRevision: revision,
      savedAt,
      draft: {
        defaultLocale: recipe.defaultLocale,
        referenceServings: getReferenceServings(recipe),
        translations: toEditableTranslations(recipe.translations, recipe.slug),
        tags: recipe.tags,
        status: recipe.status,
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
    await ctx.db.patch(recipe._id, { status: "draft" });
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

    return {
      recipeId: recipe._id,
      slug: recipe.slug,
      storageId: args.storageId,
      ...saved,
    };
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

    return {
      recipeId: recipe._id,
      slug: recipe.slug,
      heroImageUrl: args.imageUrl,
      ...saved,
    };
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

    return {
      recipeId: recipe._id,
      slug: recipe.slug,
      storageId: args.storageId,
      ...saved,
    };
  },
});

export const seed = mutation({
  args: {
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    const changes = await Promise.all(recipes.map(async (recipe) => {
      const existing = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", recipe.slug))
        .unique();

      if (existing) {
        const referenceServings = existing.referenceServings ?? recipe.referenceServings;
        const seededRecipe = {
          ...recipe,
          ...(referenceServings !== undefined ? { referenceServings } : {}),
        };
        const nextRecipe = existing.imageCredit
          ? {
              ...seededRecipe,
              heroImageStorageId: existing.heroImageStorageId,
              heroImageUrl: existing.heroImageUrl,
              imageCredit: existing.imageCredit,
            }
          : {
              ...seededRecipe,
              heroImageStorageId: existing.heroImageStorageId,
            };

        await ctx.db.replace(existing._id, nextRecipe);
        return "updated" as const;
      } else {
        await ctx.db.insert("recipes", recipe);
        return "inserted" as const;
      }
    }));

    return {
      inserted: changes.filter((change) => change === "inserted").length,
      updated: changes.filter((change) => change === "updated").length,
      total: recipes.length,
    };
  },
});

async function localize(ctx: QueryCtx, recipe: RecipeDoc, locale: Locale) {
  if (!recipe.translations || !recipe.defaultLocale) {
    throw new Error(`Recipe ${recipe.slug} has not been migrated`);
  }

  const translation = recipe.translations[locale];
  const { servings, yieldLabel, ...content } = translation;
  const storedHeroImageUrl = recipe.heroImageStorageId
    ? await ctx.storage.getUrl(recipe.heroImageStorageId)
    : null;

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
    tags: recipe.tags,
    status: recipe.status,
    ...content,
    yieldLabel: resolveYieldLabel({
      locale,
      slug: recipe.slug,
      yieldLabel,
      servings,
    }),
  };
}

function getReferenceServings(
  source: Pick<RecipeDoc | RecipeDraftDoc, "referenceServings" | "translations">,
) {
  return resolveReferenceServings(
    source.referenceServings,
    source.translations.fr.servings,
  );
}

type StoredLocalizedRecipe = RecipeDoc["translations"][Locale];
type EditableLocalizedRecipe = Omit<
  StoredLocalizedRecipe,
  "servings" | "yieldLabel"
> & { yieldLabel: string };
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
  source: Pick<RecipeDoc | RecipeDraftDoc, "defaultLocale" | "referenceServings" | "translations" | "tags">,
  slug: string,
): RecipeDraftContentLike {
  return {
    defaultLocale: source.defaultLocale,
    referenceServings: getReferenceServings(source),
    translations: toEditableTranslations(source.translations, slug),
    tags: source.tags,
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
    yieldLabel: resolveYieldLabel({ locale, slug, yieldLabel, servings }),
  };
}

function toStoredTranslations(
  translations: EditableTranslations,
  legacyTranslations?: RecipeDoc["translations"],
): RecipeDoc["translations"] {
  return {
    fr: {
      ...translations.fr,
      servings: legacyTranslations?.fr.servings ?? null,
    },
    en: {
      ...translations.en,
      servings: legacyTranslations?.en.servings ?? null,
    },
  };
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
    translations: recipe.translations,
    tags: recipe.tags,
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
  await ctx.db.patch(draft._id, { ...patch, revision, updatedAt: savedAt });
  return { revision, savedAt };
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

function assertProspectiveDraft(draft: {
  defaultLocale: Locale;
  tags: string[];
  translations: RecipeDoc["translations"];
  heroImageUrl?: string;
  imageCredit?: RecipeDraftDoc["imageCredit"];
  [key: string]: unknown;
}, slug: string) {
  assertRecipeBounds({
    ...draft,
    translations: toEditableTranslations(draft.translations, slug),
  });
  assertImagePatchLimits({
    heroImageStorageId: undefined,
    heroImageUrl: draft.heroImageUrl ?? "",
    imageCredit: draft.imageCredit,
  });
  assertRecipeDraftBytes(draft);
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
  if (getRecipeReadiness(
    toEditableRecipeContent(draft, slug),
    Boolean(draft.heroImageStorageId || draft.heroImageUrl),
  ).blockers.length) {
    throw new Error("RECIPE_NOT_READY");
  }
}

function assertRecipeBounds(recipe: RecipeDraftContentLike) {
  assertRecipeDraftLimits(recipe);
  if (recipe.tags.length > 50) throw new Error("RECIPE_LIMIT_EXCEEDED");
  for (const localized of Object.values(recipe.translations)) {
    if (
      localized.ingredients.length > 200 ||
      localized.sections.length > 50 ||
      localized.subRecipes.length > 25 ||
      localized.notes.length > 100 ||
      localized.sections.some((section) => section.steps.length > 100) ||
      localized.subRecipes.some((subRecipe) => subRecipe.ingredients.length > 100)
    ) {
      throw new Error("RECIPE_LIMIT_EXCEEDED");
    }
  }
  assertRecipeDraftBytes(recipe);
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
