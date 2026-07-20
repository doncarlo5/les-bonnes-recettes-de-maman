import { z } from "zod";
import {
  assertRecipeDraftBytes,
  RECIPE_FIELD_LIMITS,
} from "@/lib/recipe-admin-domain";
import {
  MAX_REFERENCE_SERVINGS,
  MIN_REFERENCE_SERVINGS,
} from "@/lib/recipe-servings";

const limits = RECIPE_FIELD_LIMITS;

const ingredientSchema = z.object({
  name: z.string().max(limits.ingredientName),
  quantity: z.string().max(limits.shortValue),
  unit: z.string().max(limits.shortValue),
  notes: z.string().max(limits.longText),
});

const sectionSchema = z.object({
  title: z.string().max(limits.title),
  steps: z.array(z.string().max(limits.longText)).max(100),
});

const subRecipeSchema = z.object({
  title: z.string().max(limits.title),
  ingredients: z.array(ingredientSchema).max(100),
});

const localizedRecipeSchema = z.object({
  title: z.string().max(limits.title),
  author: z.string().max(limits.author),
  description: z.string().max(limits.description),
  yieldLabel: z.string().max(limits.shortValue),
  prepTime: z.string().max(limits.shortValue),
  cookTime: z.string().max(limits.shortValue),
  totalTime: z.string().max(limits.shortValue),
  timeLabel: z.string().max(limits.shortValue),
  temperature: z.string().max(limits.shortValue),
  ingredients: z.array(ingredientSchema).max(200),
  sections: z.array(sectionSchema).max(50),
  subRecipes: z.array(subRecipeSchema).max(25),
  notes: z.array(z.string().max(limits.longText)).max(100),
});

const editableRecipeDraftObject = z.object({
  defaultLocale: z.union([z.literal("fr"), z.literal("en")]),
  referenceServings: z
    .number()
    .int()
    .min(MIN_REFERENCE_SERVINGS)
    .max(MAX_REFERENCE_SERVINGS)
    .optional(),
  translations: z.object({
    fr: localizedRecipeSchema,
    en: localizedRecipeSchema,
  }),
  tags: z.array(z.string().max(limits.shortValue)).max(50),
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

export type RecipeDraftFormInput = z.input<typeof editableRecipeDraftSchema>;
export type RecipeDraftPayload = z.output<typeof editableRecipeDraftSchema>;

export function parseOptionalNumberInput(value: unknown) {
  return value === "" || value === null || value === undefined
    ? undefined
    : Number(value);
}
