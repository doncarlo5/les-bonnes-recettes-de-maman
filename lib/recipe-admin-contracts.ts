import { z } from "zod";
import { compatibleRecipeDraftSchema } from "@/components/recipes/recipe-form-schema";

const slug = z.string().trim().min(1).max(200);
const revision = z.number().int().nonnegative();
const optionalUrl = z.url().max(2_048);

export const adminAccessRequestSchema = z.strictObject({
  locale: z.enum(["fr", "en"]),
  password: z.string().max(1_024),
  redirectTo: z.string().max(2_048).optional(),
});

export const adminRecipeIdeaCreateRequestSchema = z.strictObject({
  authorName: z.string().max(60).optional(),
  text: z.string().min(1).max(1_500),
});

export const adminRecipeIdeaDeleteRequestSchema = z.strictObject({
  ideaId: z.string().trim().min(1).max(200),
});

export const revisionedRecipeRequestSchema = z.strictObject({
  slug,
  expectedRevision: revision,
});

export const unpublishRecipeRequestSchema = z.strictObject({ slug });

export const saveRecipeRequestSchema = z
  .strictObject({
    locale: z.enum(["fr", "en"]),
    mode: z.enum(["create", "update"]),
    slug: z.string().trim().max(200).default(""),
    recipePayload: z.string().min(1),
    expectedRevision: revision.default(0),
    sourceIdeaId: z.string().trim().min(1).max(200).optional(),
    force: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "update" && !value.slug) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "Recette introuvable.",
      });
    }
  });

export const heroImageRequestSchema = revisionedRecipeRequestSchema.extend({
  storageId: z.string().trim().min(1),
});

export const cleanupImageRequestSchema = z.strictObject({
  slug,
  storageId: z.string().trim().min(1),
});

export const unsplashImageRequestSchema = revisionedRecipeRequestSchema.extend({
  imageUrl: optionalUrl,
  alt: z.string().max(1_000).default(""),
  photographerName: z.string().trim().min(1).max(1_000),
  photographerUrl: optionalUrl,
  photoUrl: optionalUrl,
});

export const openverseCreditSchema = z.strictObject({
  title: z.string().max(1_000),
  creator: z.string().max(1_000),
  creatorUrl: optionalUrl,
  imageUrl: optionalUrl,
  landingUrl: optionalUrl,
  license: z.string().max(1_000),
  licenseVersion: z.string().max(1_000),
  licenseUrl: optionalUrl,
  source: z.string().max(1_000),
  attribution: z.string().max(1_000),
  alt: z.string().max(1_000),
});

export const openverseImportRequestSchema = z.strictObject({
  imageUrl: optionalUrl,
});
export const storageUploadResponseSchema = z.strictObject({
  storageId: z.string().trim().min(1),
});
export const openverseImageRequestSchema = revisionedRecipeRequestSchema.extend(
  {
    storageId: z.string().trim().min(1),
    imageCredit: openverseCreditSchema,
  },
);

export const recipeImageCreditSchema = z.discriminatedUnion("provider", [
  z.strictObject({
    provider: z.literal("unsplash"),
    photographerName: z.string(),
    photographerUrl: z.string(),
    photoUrl: z.string(),
    alt: z.string(),
  }),
  openverseCreditSchema.extend({ provider: z.literal("openverse") }),
]);

export const mutationErrorSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("validation"),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()),
    formError: z.string().optional(),
  }),
  z.strictObject({
    type: z.literal("conflict"),
    message: z.string(),
    latestRevision: z.number().optional(),
  }),
  z.strictObject({ type: z.literal("error"), message: z.string() }),
]);

export const imageMutationSuccessSchema = z.strictObject({
  type: z.literal("success"),
  slug: z.string(),
  revision: z.number(),
  savedAt: z.number(),
  heroImageUrl: z.string(),
  imageCredit: recipeImageCreditSchema.optional(),
});

export const storageImportSuccessSchema = z.strictObject({
  type: z.literal("success"),
  storageId: z.string().trim().min(1),
});

export const cleanupImageSuccessSchema = z.discriminatedUnion("referenced", [
  z.strictObject({
    type: z.literal("success"),
    referenced: z.literal(false),
    slug: z.string(),
  }),
  imageMutationSuccessSchema.extend({ referenced: z.literal(true) }),
]);

export const slugMutationSuccessSchema = z.strictObject({
  type: z.literal("success"),
  slug: z.string(),
});

export const revisionMutationSuccessSchema = slugMutationSuccessSchema.extend({
  revision: z.number().int().nonnegative(),
  publishedRevision: z.number().int(),
  savedAt: z.number(),
});

export const saveRecipeSuccessSchema = z.strictObject({
  type: z.literal("success"),
  message: z.string(),
  slug: z.string(),
  revision: z.number().int().nonnegative(),
  savedAt: z.number(),
});

export const discardRecipeSuccessSchema = revisionMutationSuccessSchema.extend({
  draft: compatibleRecipeDraftSchema,
});

export const uploadUrlSuccessSchema = z.strictObject({
  type: z.literal("success"),
  uploadUrl: z.url(),
});

export type ImageMutationSuccess = z.infer<typeof imageMutationSuccessSchema>;
export type MutationError = z.infer<typeof mutationErrorSchema>;

export function parseRecipePayload(payload: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return {
      success: false as const,
      error: "Données du formulaire invalides.",
    };
  }
  const parsed = compatibleRecipeDraftSchema.safeParse(raw);
  return parsed.success
    ? {
        success: true as const,
        data: parsed.data,
        legacyStepLocales: getLegacyStepLocales(raw),
      }
    : { success: false as const, issues: parsed.error.issues };
}

function getLegacyStepLocales(raw: unknown) {
  const modern = { fr: false, en: false };
  if (!raw || typeof raw !== "object" || !("translations" in raw)) return modern;
  const translations = (raw as { translations?: unknown }).translations;
  if (!translations || typeof translations !== "object") return modern;
  return {
    fr: hasLegacyLocalizedStepShape((translations as { fr?: unknown }).fr),
    en: hasLegacyLocalizedStepShape((translations as { en?: unknown }).en),
  };
}

function hasLegacyLocalizedStepShape(localized: unknown) {
    if (!localized || typeof localized !== "object") return false;
    const value = localized as { ingredients?: unknown; sections?: unknown; subRecipes?: unknown };
    const ingredients = Array.isArray(value.ingredients) ? value.ingredients : [];
    const sections = Array.isArray(value.sections) ? value.sections : [];
    const subRecipeIngredients = Array.isArray(value.subRecipes)
      ? value.subRecipes.flatMap((subRecipe) =>
          subRecipe && typeof subRecipe === "object" && "ingredients" in subRecipe && Array.isArray(subRecipe.ingredients)
            ? subRecipe.ingredients
            : [],
        )
      : [];
    return ingredients.some(
      (ingredient) => !ingredient || typeof ingredient !== "object" || !("id" in ingredient),
    ) || subRecipeIngredients.some(
      (ingredient) => !ingredient || typeof ingredient !== "object" || !("id" in ingredient),
    ) || sections.some((section) => {
      if (!section || typeof section !== "object" || !("steps" in section)) return false;
      const steps = (section as { steps?: unknown }).steps;
      return Array.isArray(steps) && steps.some((step) => typeof step === "string");
    });
}
