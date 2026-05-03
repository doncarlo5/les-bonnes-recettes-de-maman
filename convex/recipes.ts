import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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

    return publishedRecipes
      .map((recipe) => localize(recipe, args.locale))
      .sort((a, b) => a.title.localeCompare(b.title, args.locale));
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

    return localize(recipe, args.locale);
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
        await ctx.db.replace(existing._id, recipe);
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

function localize(recipe: RecipeDoc, locale: Locale) {
  if (!recipe.translations || !recipe.defaultLocale) {
    throw new Error(`Recipe ${recipe.slug} has not been migrated`);
  }

  const translation = recipe.translations[locale];

  return {
    _id: recipe._id,
    _creationTime: recipe._creationTime,
    slug: recipe.slug,
    heroImageUrl: recipe.heroImageUrl,
    defaultLocale: recipe.defaultLocale,
    tags: recipe.tags,
    status: recipe.status,
    ...translation,
  };
}
