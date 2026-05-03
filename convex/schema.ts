import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  recipes: defineTable({
    title: v.string(),
    slug: v.string(),
    author: v.string(),
    description: v.string(),
    heroImageUrl: v.string(),
    totalMinutes: v.number(),
    servings: v.object({
      quantity: v.number(),
      unit: v.string(),
    }),
    ingredients: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.number()),
        unit: v.optional(v.string()),
      }),
    ),
    sections: v.array(
      v.object({
        title: v.string(),
        steps: v.array(v.string()),
      }),
    ),
    tags: v.array(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
  })
    .index("by_slug", ["slug"])
    .index("by_status_and_title", ["status", "title"]),
});
