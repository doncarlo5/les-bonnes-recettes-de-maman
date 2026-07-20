import { describe, expect, it } from "vitest";
import { RECIPE_FIELD_LIMITS } from "@/lib/recipe-admin-domain";
import {
  editableRecipeDraftSchema,
  compatibleRecipeDraftSchema,
  parseOptionalNumberInput,
  type RecipeDraftFormInput,
} from "./recipe-form-schema";

const blankLocalizedRecipe = {
  title: "",
  author: "",
  description: "",
  yieldLabel: "",
  prepTime: "",
  cookTime: "",
  totalTime: "",
  timeLabel: "",
  temperature: "",
  ingredients: [{ name: "", quantity: "", unit: "", notes: "" }],
  sections: [{ title: "", steps: [""] }],
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
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories).toEqual(["dessert"]);
      expect(result.data.legacyCategoryLabels).toEqual(["recette de famille"]);
    }
  });

  it("accepts an incomplete working draft without a publication status", () => {
    const result = editableRecipeDraftSchema.safeParse(blankDraft());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("status");
      expect(result.data.referenceServings).toBeUndefined();
    }
  });

  it("rejects structurally invalid working draft fields", () => {
    const draft = blankDraft();
    draft.referenceServings = 0;
    draft.translations.fr.title = "x".repeat(RECIPE_FIELD_LIMITS.title + 1);

    const result = editableRecipeDraftSchema.safeParse(draft);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining([
          "referenceServings",
          "translations.fr.title",
        ]),
      );
    }
  });

  it("accepts explicit legacy labels but rejects non-canonical categories", () => {
    const legacyDraft = { ...blankDraft(), legacyCategoryLabels: ["repas de famille"] };
    expect(editableRecipeDraftSchema.safeParse(legacyDraft).success).toBe(true);

    const invalidDraft = { ...blankDraft(), categories: ["brunch"] };
    expect(editableRecipeDraftSchema.safeParse(invalidDraft).success).toBe(false);
  });
});
