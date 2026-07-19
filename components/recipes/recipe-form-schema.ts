import { z } from "zod";
import {
  assertRecipeDraftBytes,
  RECIPE_FIELD_LIMITS,
} from "@/lib/recipe-admin-domain";

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
    referenceServings: z.number().int().min(1).max(50).optional(),
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

export const editableRecipeContentSchema = editableRecipeDraftObject
  .extend({
    status: z.union([z.literal("draft"), z.literal("published")]),
  })
  .superRefine((recipe, ctx) => {
    if (recipe.status !== "published") return;

    const fr = recipe.translations.fr;
    const hasTime = [fr.prepTime, fr.cookTime, fr.totalTime, fr.timeLabel].some(
      (value) => value.trim().length > 0,
    );
    const hasIngredient = fr.ingredients.some((ingredient) =>
      ingredient.name.trim(),
    );
    const hasSectionStep = fr.sections.some(
      (section) =>
        section.title.trim() &&
        section.steps.some((step) => step.trim().length > 0),
    );

    addPublishedIssue(ctx, fr.title, ["translations", "fr", "title"]);
    addPublishedIssue(ctx, fr.description, [
      "translations",
      "fr",
      "description",
    ]);
    addPublishedIssue(ctx, fr.author, ["translations", "fr", "author"]);

    if (!hasTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Au moins un temps FR est obligatoire pour publier.",
        path: ["translations", "fr", "timeLabel"],
      });
    }

    if (!hasIngredient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Au moins un ingredient FR est obligatoire pour publier.",
        path: ["translations", "fr", "ingredients"],
      });
    }

    if (!hasSectionStep) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Au moins une section FR avec une etape est obligatoire pour publier.",
        path: ["translations", "fr", "sections"],
      });
    }
  });

export type RecipeFormPayload = z.infer<typeof editableRecipeContentSchema>;
export type RecipeDraftPayload = z.infer<typeof editableRecipeDraftSchema>;

function addPublishedIssue(
  ctx: z.RefinementCtx,
  value: string,
  path: (string | number)[],
) {
  if (value.trim()) return;

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Champ obligatoire pour publier.",
    path,
  });
}
