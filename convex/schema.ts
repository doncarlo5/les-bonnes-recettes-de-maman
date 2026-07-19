import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const ingredient = v.object({
  name: v.string(),
  quantity: v.string(),
  unit: v.string(),
  notes: v.string(),
});

const section = v.object({
  title: v.string(),
  steps: v.array(v.string()),
});

const subRecipe = v.object({
  title: v.string(),
  ingredients: v.array(ingredient),
});

const localizedRecipe = v.object({
  title: v.string(),
  author: v.string(),
  description: v.string(),
  // Transitional legacy field. Keep required until the yield-label backfill has run.
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
  ingredients: v.array(ingredient),
  sections: v.array(section),
  subRecipes: v.array(subRecipe),
  notes: v.array(v.string()),
});

const imageCredit = v.union(
  v.object({
    provider: v.literal("unsplash"),
    photographerName: v.string(),
    photographerUrl: v.string(),
    photoUrl: v.string(),
    alt: v.string(),
  }),
  v.object({
    provider: v.literal("openverse"),
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
  }),
);

export default defineSchema({
  recipes: defineTable({
    slug: v.string(),
    heroImageStorageId: v.optional(v.id("_storage")),
    heroImageUrl: v.string(),
    imageCredit: v.optional(imageCredit),
    defaultLocale: v.union(v.literal("fr"), v.literal("en")),
    translations: v.object({
      fr: localizedRecipe,
      en: localizedRecipe,
    }),
    tags: v.array(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),
  recipeDrafts: defineTable({
    recipeId: v.id("recipes"),
    heroImageStorageId: v.optional(v.id("_storage")),
    heroImageUrl: v.string(),
    imageCredit: v.optional(imageCredit),
    defaultLocale: v.union(v.literal("fr"), v.literal("en")),
    translations: v.object({
      fr: localizedRecipe,
      en: localizedRecipe,
    }),
    tags: v.array(v.string()),
    revision: v.number(),
    publishedRevision: v.number(),
    updatedAt: v.number(),
  }).index("by_recipeId", ["recipeId"]),
});
