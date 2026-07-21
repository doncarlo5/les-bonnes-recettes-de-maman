import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const ingredient = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  quantity: v.string(),
  unit: v.string(),
  notes: v.string(),
});

const stepIngredientUse = v.object({
  ingredientId: v.string(),
  amount: v.optional(v.object({ quantity: v.string(), unit: v.string() })),
});

const recipeStep = v.object({
  id: v.string(),
  text: v.string(),
  ingredientUses: v.array(stepIngredientUse),
});

const section = v.object({
  title: v.string(),
  // Deprecated after the structured-step migration; retained for rollback safety.
  steps: v.array(v.string()),
  stepDetails: v.optional(v.array(recipeStep)),
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
  restTime: v.optional(v.string()),
  totalTime: v.string(),
  timeLabel: v.string(),
  temperature: v.string(),
  equipment: v.optional(v.array(v.string())),
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

const recipeCategory = v.union(
  v.literal("dessert"),
  v.literal("plat"),
  v.literal("sucre"),
  v.literal("sale"),
);

export default defineSchema({
  recipes: defineTable({
    slug: v.string(),
    heroImageStorageId: v.optional(v.id("_storage")),
    heroImageUrl: v.string(),
    imageCredit: v.optional(imageCredit),
    defaultLocale: v.union(v.literal("fr"), v.literal("en")),
    referenceServings: v.optional(v.number()),
    relatedRecipeSlugs: v.optional(v.array(v.string())),
    translations: v.object({
      fr: localizedRecipe,
      en: localizedRecipe,
    }),
    // Transitional fields for the categories migration. `tags` is removed after
    // every production document has categories and no legacy labels remain.
    tags: v.optional(v.array(v.string())),
    categories: v.optional(v.array(recipeCategory)),
    legacyCategoryLabels: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("published")),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_heroImageStorageId", ["heroImageStorageId"]),
  recipeDrafts: defineTable({
    recipeId: v.id("recipes"),
    heroImageStorageId: v.optional(v.id("_storage")),
    heroImageUrl: v.string(),
    imageCredit: v.optional(imageCredit),
    defaultLocale: v.union(v.literal("fr"), v.literal("en")),
    referenceServings: v.optional(v.number()),
    relatedRecipeSlugs: v.optional(v.array(v.string())),
    translations: v.object({
      fr: localizedRecipe,
      en: localizedRecipe,
    }),
    tags: v.optional(v.array(v.string())),
    categories: v.optional(v.array(recipeCategory)),
    legacyCategoryLabels: v.optional(v.array(v.string())),
    revision: v.number(),
    publishedRevision: v.number(),
    updatedAt: v.number(),
  })
    .index("by_recipeId", ["recipeId"])
    .index("by_heroImageStorageId", ["heroImageStorageId"]),
  recipeComments: defineTable({
    recipeId: v.id("recipes"),
    authorName: v.optional(v.string()),
    text: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
    ownerDigest: v.string(),
    // Transitional marker used by the comment-count backfill.
    countedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_recipeId", ["recipeId"])
    .index("by_photoStorageId", ["photoStorageId"]),
  recipeCommentSummaries: defineTable({
    recipeId: v.id("recipes"),
    commentCount: v.number(),
  }).index("by_recipeId", ["recipeId"]),
  commentReactions: defineTable({
    commentId: v.id("recipeComments"),
    participantDigest: v.string(),
    direction: v.union(v.literal("up"), v.literal("down")),
    updatedAt: v.number(),
  })
    .index("by_commentId", ["commentId"])
    .index("by_commentId_and_participantDigest", [
      "commentId",
      "participantDigest",
    ]),
  commentReactionSummaries: defineTable({
    commentId: v.id("recipeComments"),
    thumbsUpCount: v.number(),
    thumbsDownCount: v.number(),
  }).index("by_commentId", ["commentId"]),
  commentRateLimits: defineTable({
    participantDigest: v.string(),
    action: v.union(
      v.literal("comment"),
      v.literal("photo"),
      v.literal("reaction"),
    ),
    windowStartedAt: v.number(),
    count: v.number(),
  })
    .index("by_participantDigest_and_action", ["participantDigest", "action"])
    .index("by_windowStartedAt", ["windowStartedAt"]),
  commentPhotoClaims: defineTable({
    storageId: v.id("_storage"),
    participantDigest: v.string(),
    createdAt: v.number(),
    verificationStartedAt: v.optional(v.number()),
    verificationLeaseId: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_storageId", ["storageId"])
    .index("by_createdAt", ["createdAt"]),
});
