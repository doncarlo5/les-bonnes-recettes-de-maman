import { describe, expect, it } from "vitest";
import { RECIPE_FIELD_LIMITS } from "@/lib/recipe-admin-domain";
import {
  editableRecipeDraftSchema,
  compatibleRecipeDraftSchema,
  parseOptionalNumberInput,
  partitionRecipeServerErrors,
  type RecipeDraftFormInput,
} from "./recipe-form-schema";

const blankLocalizedRecipe = {
  title: "",
  author: "",
  description: "",
  yieldLabel: "",
  prepTime: "",
  cookTime: "",
  restTime: "",
  totalTime: "",
  timeLabel: "",
  temperature: "",
  equipment: [],
  ingredients: [
    { id: "ingredient-main-0", name: "", quantity: "", unit: "", notes: "" },
  ],
  sections: [
    { title: "", steps: [{ id: "step-0-0", text: "", ingredientUses: [] }] },
  ],
  subRecipes: [],
  notes: [],
};

function blankDraft(): RecipeDraftFormInput {
  return {
    defaultLocale: "fr",
    referenceServings: undefined,
    translations: {
      fr: structuredClone(blankLocalizedRecipe),
      en: structuredClone(blankLocalizedRecipe),
    },
    categories: [],
    relatedRecipeSlugs: [],
  };
}

describe("editableRecipeDraftSchema", () => {
  it("converts an empty optional number control without producing NaN", () => {
    expect(parseOptionalNumberInput("")).toBeUndefined();
    expect(parseOptionalNumberInput("6")).toBe(6);
  });

  it("normalizes legacy tags for route and offline recovery compatibility", () => {
    const { categories: _categories, ...legacyDraft } = blankDraft();
    const result = compatibleRecipeDraftSchema.safeParse({
      ...legacyDraft,
      tags: ["dessert", "recette de famille"],
      status: "published",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories).toEqual(["dessert"]);
      expect(result.data.legacyCategoryLabels).toEqual(["recette de famille"]);
      expect(result.data).not.toHaveProperty("status");
    }
  });

  it("normalizes ingredients and string steps from legacy recovery records", () => {
    const localized = {
      ...structuredClone(blankLocalizedRecipe),
      ingredients: [{ name: "Farine", quantity: "200", unit: "g", notes: "" }],
      sections: [{ title: "Préparation", steps: ["Mélanger"] }],
    };
    const result = compatibleRecipeDraftSchema.safeParse({
      ...blankDraft(),
      translations: { fr: localized, en: localized },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.translations.fr.ingredients[0].id).toBe(
        "ingredient-main-0",
      );
      expect(result.data.translations.fr.sections[0].steps[0]).toEqual({
        id: "step-0-0",
        text: "Mélanger",
        ingredientUses: [],
      });
    }
  });

  it("restores recovery records created before Marmiton metadata existed", () => {
    const { relatedRecipeSlugs: _related, ...legacyDraft } = blankDraft();
    for (const localized of Object.values(legacyDraft.translations)) {
      delete (localized as Partial<typeof blankLocalizedRecipe>).restTime;
      delete (localized as Partial<typeof blankLocalizedRecipe>).equipment;
    }

    const result = compatibleRecipeDraftSchema.safeParse(legacyDraft);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relatedRecipeSlugs).toEqual([]);
      expect(result.data.translations.fr.restTime).toBe("");
      expect(result.data.translations.fr.equipment).toEqual([]);
      expect(result.data.translations.en.restTime).toBe("");
      expect(result.data.translations.en.equipment).toEqual([]);
    }
  });

  it("accepts an incomplete working draft without a publication status", () => {
    const result = editableRecipeDraftSchema.safeParse(blankDraft());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("status");
      expect(result.data.referenceServings).toBeUndefined();
      expect(result.data.relatedRecipeSlugs).toEqual([]);
    }
  });

  it("rejects missing and duplicate ingredient references", () => {
    const missing = blankDraft();
    missing.translations.fr.sections[0].steps[0].ingredientUses = [
      { ingredientId: "missing" },
    ];
    expect(editableRecipeDraftSchema.safeParse(missing).success).toBe(false);

    const duplicate = blankDraft();
    duplicate.translations.fr.sections[0].steps[0].ingredientUses = [
      { ingredientId: "ingredient-main-0" },
      { ingredientId: "ingredient-main-0" },
    ];
    expect(editableRecipeDraftSchema.safeParse(duplicate).success).toBe(false);
  });

  it("rejects duplicate step identifiers within one language", () => {
    const draft = blankDraft();
    draft.translations.fr.sections.push({
      title: "Suite",
      steps: [{ id: "step-0-0", text: "Cuire", ingredientUses: [] }],
    });

    expect(editableRecipeDraftSchema.safeParse(draft).success).toBe(false);
  });

  it("accepts Marmiton-style resting time, utensils and related recipes", () => {
    const draft = blankDraft();
    draft.translations.fr.restTime = "30 min";
    draft.translations.fr.equipment = ["1 moule à cake"];
    draft.relatedRecipeSlugs = ["mayonnaise"];

    expect(editableRecipeDraftSchema.safeParse(draft).success).toBe(true);
  });

  it("rejects malformed related recipe slugs", () => {
    const draft = blankDraft();
    draft.relatedRecipeSlugs = ["../mayonnaise"];

    expect(editableRecipeDraftSchema.safeParse(draft).success).toBe(false);
  });

  it("rejects structurally invalid working draft fields", () => {
    const draft = blankDraft();
    draft.referenceServings = 0;
    draft.translations.fr.title = "x".repeat(RECIPE_FIELD_LIMITS.title + 1);

    const result = editableRecipeDraftSchema.safeParse(draft);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["referenceServings", "translations.fr.title"]),
      );
    }
  });

  it("accepts explicit legacy labels but rejects non-canonical categories", () => {
    const legacyDraft = {
      ...blankDraft(),
      legacyCategoryLabels: ["repas de famille"],
    };
    expect(editableRecipeDraftSchema.safeParse(legacyDraft).success).toBe(true);

    const invalidDraft = { ...blankDraft(), categories: ["brunch"] };
    expect(editableRecipeDraftSchema.safeParse(invalidDraft).success).toBe(
      false,
    );
  });

  it("rejects unknown keys at every structural boundary", () => {
    expect(
      editableRecipeDraftSchema.safeParse({ ...blankDraft(), status: "draft" })
        .success,
    ).toBe(false);
    const draft = blankDraft();
    const withUnknownIngredient = {
      ...draft,
      translations: {
        ...draft.translations,
        fr: {
          ...draft.translations.fr,
          ingredients: [
            { ...draft.translations.fr.ingredients[0], unexpected: true },
          ],
        },
      },
    };
    expect(
      editableRecipeDraftSchema.safeParse(withUnknownIngredient).success,
    ).toBe(false);
  });

  it("keeps unknown server paths at the root boundary", () => {
    const result = partitionRecipeServerErrors({
      "translations.fr.title": "Titre invalide",
      "metadata.internal": "Erreur globale",
    });

    expect(result.fields).toEqual([
      ["translations.fr.title", "Titre invalide"],
    ]);
    expect(result.hasUnmappedPath).toBe(true);
  });
});
