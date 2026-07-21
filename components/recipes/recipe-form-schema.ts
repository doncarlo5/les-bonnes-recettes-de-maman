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
import { legacyIngredientId, legacyStepId } from "@/lib/recipe-item-ids";

const limits = RECIPE_FIELD_LIMITS;
const recipeSlugSchema = z
  .string()
  .max(limits.shortValue)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Utilise le slug exact de la recette.");

const ingredientSchema = z.strictObject({
  id: z.string().min(1).max(limits.shortValue),
  name: z.string().max(limits.ingredientName),
  quantity: z.string().max(limits.shortValue),
  unit: z.string().max(limits.shortValue),
  notes: z.string().max(limits.longText),
});

const stepIngredientUseSchema = z.strictObject({
  ingredientId: z.string().min(1).max(limits.shortValue),
  amount: z
    .strictObject({
      quantity: z.string().max(limits.shortValue),
      unit: z.string().max(limits.shortValue),
    })
    .optional(),
});

const recipeStepSchema = z.strictObject({
  id: z.string().min(1).max(limits.shortValue),
  text: z.string().max(limits.longText),
  ingredientUses: z.array(stepIngredientUseSchema).max(200),
});

const sectionSchema = z.strictObject({
  title: z.string().max(limits.title),
  steps: z.array(recipeStepSchema).max(100),
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
    for (const locale of ["fr", "en"] as const) {
      const localized = recipe.translations[locale];
      const ingredients = [
        ...localized.ingredients,
        ...localized.subRecipes.flatMap((subRecipe) => subRecipe.ingredients),
      ];
      const ids = new Set<string>();
      const stepIds = new Set<string>();
      for (const ingredient of ingredients) {
        if (ids.has(ingredient.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Chaque ingrédient doit avoir un identifiant unique.",
            path: ["translations", locale, "ingredients"],
          });
        }
        ids.add(ingredient.id);
      }
      for (const [sectionIndex, section] of localized.sections.entries()) {
        for (const [stepIndex, step] of section.steps.entries()) {
          if (stepIds.has(step.id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Chaque étape doit avoir un identifiant unique.",
              path: [
                "translations",
                locale,
                "sections",
                sectionIndex,
                "steps",
                stepIndex,
                "id",
              ],
            });
          }
          stepIds.add(step.id);
          const used = new Set<string>();
          for (const use of step.ingredientUses) {
            if (!ids.has(use.ingredientId) || used.has(use.ingredientId)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: !ids.has(use.ingredientId)
                  ? "Cet ingrédient n’existe plus."
                  : "Un ingrédient ne peut apparaître qu’une fois par étape.",
                path: [
                  "translations",
                  locale,
                  "sections",
                  sectionIndex,
                  "steps",
                  stepIndex,
                  "ingredientUses",
                ],
              });
            }
            used.add(use.ingredientId);
          }
        }
      }
    }
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

const legacyIngredientSchema = ingredientSchema.omit({ id: true });
const legacySectionSchema = z.strictObject({
  title: z.string().max(limits.title),
  steps: z.array(z.string().max(limits.longText)).max(100),
});
const legacySubRecipeSchema = z.strictObject({
  title: z.string().max(limits.title),
  ingredients: z.array(legacyIngredientSchema).max(100),
});
const trulyLegacyLocalizedRecipeSchema = legacyLocalizedRecipeSchema.extend({
  ingredients: z.array(legacyIngredientSchema).max(200),
  sections: z.array(legacySectionSchema).max(50),
  subRecipes: z.array(legacySubRecipeSchema).max(25),
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
      fr: z.union([
        legacyLocalizedRecipeSchema,
        trulyLegacyLocalizedRecipeSchema,
      ]),
      en: z.union([
        legacyLocalizedRecipeSchema,
        trulyLegacyLocalizedRecipeSchema,
      ]),
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
    const content =
      "tags" in recipe
        ? (() => {
            const { tags, status: _status, ...rest } = recipe;
            return { ...rest, ...resolveRecipeCategories({ tags }) };
          })()
        : recipe;
    return {
      ...content,
      translations: {
        fr: normalizeLegacyLocalizedRecipe(content.translations.fr),
        en: normalizeLegacyLocalizedRecipe(content.translations.en),
      },
    };
  })
  .pipe(editableRecipeDraftSchema);

export type RecipeDraftFormInput = z.input<typeof editableRecipeDraftSchema>;
export type RecipeDraftPayload = z.output<typeof editableRecipeDraftSchema>;

const recipeFieldPathPattern =
  /^(defaultLocale|referenceServings|relatedRecipeSlugs(?:\.\d+)?|categories(?:\.\d+)?|legacyCategoryLabels(?:\.\d+)?|translations\.(fr|en)\.(title|author|description|yieldLabel|prepTime|cookTime|restTime|totalTime|timeLabel|temperature|equipment\.\d+|ingredients\.\d+\.(id|name|quantity|unit|notes)|sections\.\d+\.(title|steps\.\d+\.(id|text|ingredientUses(?:\.\d+\.(ingredientId|amount\.(quantity|unit)))?))|subRecipes\.\d+\.(title|ingredients\.\d+\.(id|name|quantity|unit|notes))|notes\.\d+))$/;

function normalizeLegacyLocalizedRecipe(
  localized:
    | z.infer<typeof legacyLocalizedRecipeSchema>
    | z.infer<typeof trulyLegacyLocalizedRecipeSchema>,
) {
  return {
    ...localized,
    ingredients: localized.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id:
        "id" in ingredient ? ingredient.id : legacyIngredientId("main", index),
    })),
    sections: localized.sections.map((section, sectionIndex) => ({
      ...section,
      steps: section.steps.map((step, stepIndex) =>
        typeof step === "string"
          ? {
              id: legacyStepId(sectionIndex, stepIndex),
              text: step,
              ingredientUses: [],
            }
          : step,
      ),
    })),
    subRecipes: localized.subRecipes.map((subRecipe, subRecipeIndex) => ({
      ...subRecipe,
      ingredients: subRecipe.ingredients.map((ingredient, index) => ({
        ...ingredient,
        id:
          "id" in ingredient
            ? ingredient.id
            : legacyIngredientId(`sub-${subRecipeIndex}`, index),
      })),
    })),
  };
}

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
