import { z } from "zod";

const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  unit: z.string(),
  notes: z.string(),
});

const sectionSchema = z.object({
  title: z.string(),
  steps: z.array(z.string()).max(100),
});

const subRecipeSchema = z.object({
  title: z.string(),
  ingredients: z.array(ingredientSchema).max(100),
});

const localizedRecipeSchema = z.object({
  title: z.string(),
  author: z.string(),
  description: z.string(),
  servings: z
    .object({
      quantity: z.number().nonnegative(),
      unit: z.string(),
    })
    .nullable(),
  prepTime: z.string(),
  cookTime: z.string(),
  totalTime: z.string(),
  timeLabel: z.string(),
  temperature: z.string(),
  ingredients: z.array(ingredientSchema).max(200),
  sections: z.array(sectionSchema).max(50),
  subRecipes: z.array(subRecipeSchema).max(25),
  notes: z.array(z.string()).max(100),
});

export const editableRecipeDraftSchema = z.object({
    defaultLocale: z.union([z.literal("fr"), z.literal("en")]),
    translations: z.object({
      fr: localizedRecipeSchema,
      en: localizedRecipeSchema,
    }),
    tags: z.array(z.string()).max(50),
  });

export const editableRecipeContentSchema = editableRecipeDraftSchema
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
