import { z } from "zod";
import type { FieldPath } from "react-hook-form";
import {
  assertRecipeDraftBytes,
  RECIPE_FIELD_LIMITS,
} from "@/lib/recipe-admin-domain";
import {
  MAX_REFERENCE_SERVINGS,
  MIN_REFERENCE_SERVINGS,
} from "@/lib/recipe-servings";
import {
  RECIPE_CATEGORIES,
  resolveRecipeCategories,
} from "@/lib/recipe-categories";

const limits = RECIPE_FIELD_LIMITS;
const recipeSlugSchema = z
  .string()
  .max(limits.shortValue)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Utilise le slug exact de la recette.");

const ingredientSchema = z.strictObject({
  name: z.string().max(limits.ingredientName),
  quantity: z.string().max(limits.shortValue),
  unit: z.string().max(limits.shortValue),
  notes: z.string().max(limits.longText),
});

const sectionSchema = z.strictObject({
  title: z.string().max(limits.title),
  steps: z.array(z.string().max(limits.longText)).max(100),
});

const subRecipeSchema = z.strictObject({
  title: z.string().max(limits.title),
  ingredients: z.array(ingredientSchema).max(100),
});

const localizedRecipeSchema = z.strictObject({
  title: z.string().max(limits.title),
  author: z.string().max(limits.author),
  description: z.string().max(limits.description),
  yieldLabel: z.string().max(limits.shortValue),
  prepTime: z.string().max(limits.shortValue),
  cookTime: z.string().max(limits.shortValue),
  restTime: z.string().max(limits.shortValue),
  totalTime: z.string().max(limits.shortValue),
  timeLabel: z.string().max(limits.shortValue),
  temperature: z.string().max(limits.shortValue),
  equipment: z.array(z.string().max(limits.shortValue)).max(50),
  ingredients: z.array(ingredientSchema).max(200),
  sections: z.array(sectionSchema).max(50),
  subRecipes: z.array(subRecipeSchema).max(25),
  notes: z.array(z.string().max(limits.longText)).max(100),
});

const editableRecipeDraftObject = z.strictObject({
  defaultLocale: z.union([z.literal("fr"), z.literal("en")]),
  referenceServings: z
    .number()
    .int()
    .min(MIN_REFERENCE_SERVINGS)
    .max(MAX_REFERENCE_SERVINGS)
    .optional(),
  relatedRecipeSlugs: z.array(recipeSlugSchema).max(20),
  translations: z.strictObject({
    fr: localizedRecipeSchema,
    en: localizedRecipeSchema,
  }),
  categories: z.array(z.enum(RECIPE_CATEGORIES)).max(RECIPE_CATEGORIES.length),
  legacyCategoryLabels: z
    .array(z.string().max(limits.shortValue))
    .max(50)
    .optional(),
});

export const editableRecipeDraftSchema = editableRecipeDraftObject.superRefine(
  (recipe, ctx) => {
    try {
      assertRecipeDraftBytes(recipe);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le brouillon dépasse la taille maximale autorisée.",
        path: [],
      });
    }
  },
);

const legacyLocalizedRecipeSchema = localizedRecipeSchema.extend({
  restTime: z.string().max(limits.shortValue).optional().default(""),
  equipment: z
    .array(z.string().max(limits.shortValue))
    .max(50)
    .optional()
    .default([]),
});

const preMarmitonRecipeDraftSchema = editableRecipeDraftObject
  .omit({
    relatedRecipeSlugs: true,
    translations: true,
  })
  .extend({
    relatedRecipeSlugs: z
      .array(recipeSlugSchema)
      .max(20)
      .optional()
      .default([]),
    translations: z.strictObject({
      fr: legacyLocalizedRecipeSchema,
      en: legacyLocalizedRecipeSchema,
    }),
  });

const legacyRecipeDraftSchema = preMarmitonRecipeDraftSchema
  .omit({ categories: true, legacyCategoryLabels: true })
  .extend({
    tags: z.array(z.string().max(limits.shortValue)).max(50),
    // Recovery records written by the pre-publication-state editor carried this
    // field. It is accepted only at this compatibility boundary and discarded.
    status: z.enum(["draft", "published"]).optional(),
  });

/** Transitional parser for route payloads and recovery records created before categories. */
export const compatibleRecipeDraftSchema = z
  .union([
    editableRecipeDraftSchema,
    preMarmitonRecipeDraftSchema,
    legacyRecipeDraftSchema,
  ])
  .transform((recipe) => {
    if (!("tags" in recipe)) return recipe;
    const { tags, status: _status, ...content } = recipe;
    return { ...content, ...resolveRecipeCategories({ tags }) };
  })
  .pipe(editableRecipeDraftSchema);

export type RecipeDraftFormInput = z.input<typeof editableRecipeDraftSchema>;
export type RecipeDraftPayload = z.output<typeof editableRecipeDraftSchema>;

const recipeFieldPathPattern =
  /^(defaultLocale|referenceServings|relatedRecipeSlugs(?:\.\d+)?|categories(?:\.\d+)?|legacyCategoryLabels(?:\.\d+)?|translations\.(fr|en)\.(title|author|description|yieldLabel|prepTime|cookTime|restTime|totalTime|timeLabel|temperature|equipment\.\d+|ingredients\.\d+\.(name|quantity|unit|notes)|sections\.\d+\.(title|steps\.\d+)|subRecipes\.\d+\.(title|ingredients\.\d+\.(name|quantity|unit|notes))|notes\.\d+))$/;

/** The only runtime boundary allowed to turn a server issue path into an RHF path. */
export function toRecipeFieldPath(
  path: string,
): FieldPath<RecipeDraftFormInput> | null {
  return recipeFieldPathPattern.test(path)
    ? (path as FieldPath<RecipeDraftFormInput>)
    : null;
}

export function partitionRecipeServerErrors(
  fieldErrors: Record<string, string>,
) {
  const fields: Array<[FieldPath<RecipeDraftFormInput>, string]> = [];
  let hasUnmappedPath = false;
  for (const [path, message] of Object.entries(fieldErrors)) {
    const fieldPath = toRecipeFieldPath(path);
    if (fieldPath) fields.push([fieldPath, message]);
    else hasUnmappedPath = true;
  }
  return { fields, hasUnmappedPath };
}

export function parseOptionalNumberInput(value: unknown) {
  return value === "" || value === null || value === undefined
    ? undefined
    : Number(value);
}
