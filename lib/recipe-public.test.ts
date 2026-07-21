import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  normalizeRecipeForDisplay,
  type PublicRecipeWire,
} from "./recipe-public";

function legacyRecipe(): PublicRecipeWire {
  return {
    _id: "recipe" as Id<"recipes">,
    _creationTime: 1,
    slug: "tarte",
    heroImageUrl: "",
    defaultLocale: "fr",
    categories: [],
    status: "published",
    title: "Tarte",
    author: "Maman",
    description: "",
    yieldLabel: "",
    prepTime: "",
    cookTime: "",
    totalTime: "",
    timeLabel: "",
    temperature: "",
    relatedRecipes: [],
    ingredients: [{ name: "Farine", quantity: "200", unit: "g", notes: "" }],
    sections: [{ title: "Préparation", steps: ["Mélanger"] }],
    subRecipes: [],
    notes: [],
  };
}

describe("normalizeRecipeForDisplay", () => {
  it("reads the historical public response without structured steps", () => {
    const normalized = normalizeRecipeForDisplay(legacyRecipe());

    expect(normalized.equipment).toEqual([]);
    expect(normalized.sections[0].steps[0]).toEqual({
      id: "step-0-0",
      text: "Mélanger",
      ingredientUses: [],
    });
    expect(normalized.ingredients[0].id).toBe("ingredient-main-0");
  });

  it("prefers additive stepDetails supplied during rollout 1", () => {
    const recipe = legacyRecipe();
    recipe.sections[0].stepDetails = [
      {
        id: "mix",
        text: "Mélanger",
        ingredientUses: [{ ingredientId: "flour" }],
      },
    ];

    expect(
      normalizeRecipeForDisplay(recipe).sections[0].steps[0].ingredientUses,
    ).toEqual([{ ingredientId: "flour" }]);
  });
});
