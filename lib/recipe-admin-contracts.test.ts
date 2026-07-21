import { describe, expect, it } from "vitest";
import { parseRecipePayload } from "./recipe-admin-contracts";

const localized = {
  title: "Tarte",
  author: "Maman",
  description: "Une tarte.",
  yieldLabel: "6 personnes",
  prepTime: "20 min",
  cookTime: "30 min",
  restTime: "",
  totalTime: "50 min",
  timeLabel: "50 min",
  temperature: "180 °C",
  equipment: [],
  ingredients: [{ id: "flour", name: "Farine", quantity: "200", unit: "g", notes: "" }],
  sections: [{ title: "Préparation", steps: [{ id: "mix", text: "Mélanger", ingredientUses: [] }] }],
  subRecipes: [],
  notes: [],
};

describe("parseRecipePayload", () => {
  it("reports legacy step compatibility independently for each locale", () => {
    const legacyFrench = {
      ...structuredClone(localized),
      ingredients: [{ name: "Farine", quantity: "200", unit: "g", notes: "" }],
      sections: [{ title: "Préparation", steps: ["Mélanger"] }],
    };
    const result = parseRecipePayload(JSON.stringify({
      defaultLocale: "fr",
      relatedRecipeSlugs: [],
      categories: [],
      translations: { fr: legacyFrench, en: localized },
    }));

    expect(result).toMatchObject({
      success: true,
      legacyStepLocales: { fr: true, en: false },
    });
  });
});
