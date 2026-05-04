import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import rawRecipes from "./recettes.json";
import { toSeedRecipe, type SourceRecipe } from "./recipeTranslations";

const localeValidator = v.union(v.literal("fr"), v.literal("en"));

type Locale = "fr" | "en";
type RecipeDoc = Doc<"recipes">;

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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const setHeroImage = mutation({
  args: {
    slug: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
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

    await ctx.db.patch(recipe._id, {
      heroImageStorageId: args.storageId,
    });

    return {
      recipeId: recipe._id,
      slug: recipe.slug,
      storageId: args.storageId,
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
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!recipe) {
      throw new Error(`Recipe ${args.slug} was not found`);
    }

    await ctx.db.patch(recipe._id, {
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
    };
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
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
    ...(!storedHeroImageUrl && recipe.imageCredit
      ? { imageCredit: recipe.imageCredit }
      : {}),
    defaultLocale: recipe.defaultLocale,
    tags: recipe.tags,
    status: recipe.status,
    ...translation,
  };
}
