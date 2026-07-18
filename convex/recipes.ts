import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import rawRecipes from "./recettes.json";
import { toSeedRecipe, type SourceRecipe } from "./recipeTranslations";

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
  translations: v.object({
    fr: localizedRecipeValidator,
    en: localizedRecipeValidator,
  }),
  tags: v.array(v.string()),
  status: v.union(v.literal("draft"), v.literal("published")),
});

const draftContentValidator = v.object({
  defaultLocale: localeValidator,
  translations: v.object({
    fr: localizedRecipeValidator,
    en: localizedRecipeValidator,
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
          hasUnpublishedChanges: revision !== publishedRevision,
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

    return {
      _id: recipe._id,
      _creationTime: recipe._creationTime,
      slug: recipe.slug,
      title: source.translations[args.locale].title,
      heroImageUrl: storedHeroImageUrl ?? source.heroImageUrl,
      imageCredit: source.imageCredit,
      defaultLocale: source.defaultLocale,
      translations: source.translations,
      tags: source.tags,
      status: recipe.status,
      revision,
      publishedRevision,
      updatedAt: draft?.updatedAt ?? recipe._creationTime,
      hasUnpublishedChanges: revision !== publishedRevision,
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

    const recipeId = await ctx.db.insert("recipes", {
      slug,
      heroImageUrl: "",
      defaultLocale: args.recipe.defaultLocale,
      translations: args.recipe.translations,
      tags: args.recipe.tags,
      status: "draft",
    });

    const now = Date.now();
    await ctx.db.insert("recipeDrafts", {
      recipeId,
      heroImageUrl: "",
      defaultLocale: args.recipe.defaultLocale,
      translations: args.recipe.translations,
      tags: args.recipe.tags,
      revision: 0,
      publishedRevision: -1,
      updatedAt: now,
    });

    return {
      recipeId,
      slug,
      title: title || "Nouvelle recette",
      revision: 0,
      publishedRevision: -1,
      updatedAt: now,
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
    const updatedAt = Date.now();

    if (currentDraft) {
      await ctx.db.patch(currentDraft._id, {
        defaultLocale: args.recipe.defaultLocale,
        translations: args.recipe.translations,
        tags: args.recipe.tags,
        revision,
        updatedAt,
      });
    } else {
      await ctx.db.insert("recipeDrafts", {
        recipeId: existing._id,
        heroImageStorageId: existing.heroImageStorageId,
        heroImageUrl: existing.heroImageUrl,
        imageCredit: existing.imageCredit,
        defaultLocale: args.recipe.defaultLocale,
        translations: args.recipe.translations,
        tags: args.recipe.tags,
        revision,
        publishedRevision: existing.status === "published" ? 0 : -1,
        updatedAt,
      });
    }

    return {
      recipeId: existing._id,
      slug: existing.slug,
      title: args.recipe.translations[args.recipe.defaultLocale].title,
      revision,
      updatedAt,
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
    assertDraftReadyForPublication(draft);

    await ctx.db.patch(recipe._id, {
      heroImageStorageId: draft.heroImageStorageId,
      heroImageUrl: draft.heroImageUrl,
      imageCredit: draft.imageCredit,
      defaultLocale: draft.defaultLocale,
      translations: draft.translations,
      tags: draft.tags,
      status: "published",
    });
    await ctx.db.patch(draft._id, {
      publishedRevision: draft.revision,
      updatedAt: Date.now(),
    });

    return { slug: recipe.slug, revision: draft.revision };
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

    const revision = draft.revision + 1;
    await ctx.db.patch(draft._id, {
      heroImageStorageId: recipe.heroImageStorageId,
      heroImageUrl: recipe.heroImageUrl,
      imageCredit: recipe.imageCredit,
      defaultLocale: recipe.defaultLocale,
      translations: recipe.translations,
      tags: recipe.tags,
      revision,
      publishedRevision: revision,
      updatedAt: Date.now(),
    });

    return { slug: recipe.slug, revision };
  },
});

export const unpublish = mutation({
  args: { slug: v.string(), adminPassword: v.string() },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);
    const recipe = await getRecipeBySlug(ctx, args.slug);
    await ctx.db.patch(recipe._id, { status: "draft" });
    return { slug: recipe.slug };
  },
});

export const setHeroImage = mutation({
  args: {
    slug: v.string(),
    storageId: v.id("_storage"),
    expectedRevision: v.optional(v.number()),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    const recipe = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!recipe) {
      throw new Error(`Recipe ${args.slug} was not found`);
    }

    const storedImage = await ctx.db.system.get(args.storageId);

    if (!storedImage) {
      throw new Error("Image was not found in Convex Storage");
    }

    const draft = await ensureRecipeDraft(ctx, recipe);
    assertExpectedRevision(draft, args.expectedRevision);
    const revision = draft.revision + 1;

    await ctx.db.patch(draft._id, {
      heroImageStorageId: args.storageId,
      heroImageUrl: "",
      imageCredit: undefined,
      revision,
      updatedAt: Date.now(),
    });

    return {
      recipeId: recipe._id,
      slug: recipe.slug,
      storageId: args.storageId,
      revision,
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
    expectedRevision: v.optional(v.number()),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    const recipe = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!recipe) {
      throw new Error(`Recipe ${args.slug} was not found`);
    }

    const draft = await ensureRecipeDraft(ctx, recipe);
    assertExpectedRevision(draft, args.expectedRevision);
    const revision = draft.revision + 1;

    await ctx.db.patch(draft._id, {
      heroImageStorageId: undefined,
      heroImageUrl: args.imageUrl,
      imageCredit: {
        provider: "unsplash",
        photographerName: args.photographerName,
        photographerUrl: args.photographerUrl,
        photoUrl: args.photoUrl,
        alt: args.alt,
      },
      revision,
      updatedAt: Date.now(),
    });

    return {
      recipeId: recipe._id,
      slug: recipe.slug,
      heroImageUrl: args.imageUrl,
      revision,
    };
  },
});

export const setOpenverseHeroImage = mutation({
  args: {
    slug: v.string(),
    storageId: v.id("_storage"),
    imageCredit: openverseImageCreditValidator,
    expectedRevision: v.optional(v.number()),
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    const recipe = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!recipe) {
      throw new Error(`Recipe ${args.slug} was not found`);
    }

    const storedImage = await ctx.db.system.get(args.storageId);

    if (!storedImage) {
      throw new Error("Image was not found in Convex Storage");
    }

    const draft = await ensureRecipeDraft(ctx, recipe);
    assertExpectedRevision(draft, args.expectedRevision);
    const revision = draft.revision + 1;

    await ctx.db.patch(draft._id, {
      heroImageStorageId: args.storageId,
      heroImageUrl: "",
      imageCredit: {
        provider: "openverse",
        ...args.imageCredit,
      },
      revision,
      updatedAt: Date.now(),
    });

    return {
      recipeId: recipe._id,
      slug: recipe.slug,
      storageId: args.storageId,
      revision,
    };
  },
});

export const seed = mutation({
  args: {
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    assertRecipeAdminPassword(args.adminPassword);

    let inserted = 0;
    let updated = 0;

    for (const recipe of recipes) {
      const existing = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", recipe.slug))
        .unique();

      if (existing) {
        const nextRecipe = existing.imageCredit
          ? {
              ...recipe,
              heroImageStorageId: existing.heroImageStorageId,
              heroImageUrl: existing.heroImageUrl,
              imageCredit: existing.imageCredit,
            }
          : {
              ...recipe,
              heroImageStorageId: existing.heroImageStorageId,
            };

        await ctx.db.replace(existing._id, nextRecipe);
        updated += 1;
      } else {
        await ctx.db.insert("recipes", recipe);
        inserted += 1;
      }
    }

    return {
      inserted,
      updated,
      total: recipes.length,
    };
  },
});

async function localize(ctx: QueryCtx, recipe: RecipeDoc, locale: Locale) {
  if (!recipe.translations || !recipe.defaultLocale) {
    throw new Error(`Recipe ${recipe.slug} has not been migrated`);
  }

  const translation = recipe.translations[locale];
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
    tags: recipe.tags,
    status: recipe.status,
    ...translation,
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

  const draftId = await ctx.db.insert("recipeDrafts", {
    recipeId: recipe._id,
    heroImageStorageId: recipe.heroImageStorageId,
    heroImageUrl: recipe.heroImageUrl,
    imageCredit: recipe.imageCredit,
    defaultLocale: recipe.defaultLocale,
    translations: recipe.translations,
    tags: recipe.tags,
    revision: 0,
    publishedRevision: recipe.status === "published" ? 0 : -1,
    updatedAt: Date.now(),
  });

  const created = await ctx.db.get(draftId);
  if (!created) throw new Error("RECIPE_DRAFT_NOT_FOUND");
  return created;
}

function assertExpectedRevision(
  draft: RecipeDraftDoc,
  expectedRevision: number | undefined,
) {
  if (
    expectedRevision !== undefined &&
    expectedRevision !== draft.revision
  ) {
    throw new Error(`RECIPE_DRAFT_CONFLICT:${draft.revision}`);
  }
}

function assertDraftReadyForPublication(draft: RecipeDraftDoc) {
  const fr = draft.translations.fr;
  const hasTime = [fr.prepTime, fr.cookTime, fr.totalTime, fr.timeLabel].some(
    (value) => value.trim().length > 0,
  );
  const hasIngredient = fr.ingredients.some((ingredient) =>
    ingredient.name.trim(),
  );
  const hasSectionStep = fr.sections.some(
    (section) =>
      section.title.trim() &&
      section.steps.some((step) => step.trim().length > 0),
  );

  if (
    !fr.title.trim() ||
    !fr.author.trim() ||
    !fr.description.trim() ||
    !hasTime ||
    !hasIngredient ||
    !hasSectionStep
  ) {
    throw new Error("RECIPE_NOT_READY");
  }
}

function assertRecipeBounds(recipe: {
  tags: string[];
  translations: RecipeDoc["translations"];
}) {
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
