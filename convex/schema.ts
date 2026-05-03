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
  ingredients: v.array(ingredient),
  sections: v.array(section),
  subRecipes: v.array(subRecipe),
  notes: v.array(v.string()),
});

export default defineSchema({
  recipes: defineTable({
    slug: v.string(),
    heroImageUrl: v.string(),
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
});
