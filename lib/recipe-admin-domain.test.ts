import { describe, expect, test } from "vitest";
import {
  getRecipeReadiness,
  type RecipeDraftContentLike,
} from "./recipe-admin-domain";

function recipe(title: string, cookTime = ""): RecipeDraftContentLike {
  const localized = {
    title,
    author: "Maman",
    description: "Description",
    yieldLabel: "Environ 500 g de pâte",
    prepTime: "15 min",
    cookTime,
    totalTime: "15 min",
    timeLabel: "15 min",
    temperature: "",
    ingredients: [{ name: "farine", quantity: "500", unit: "g", notes: "" }],
    sections: [{ title: "Préparation", steps: ["Mélanger."] }],
    subRecipes: [],
    notes: [],
  };

  return {
    defaultLocale: "fr",
    translations: { fr: localized, en: { ...localized, title: "Dough" } },
    tags: [],
  };
}

describe("recipe reference servings readiness", () => {
  test("allows an unbaked base dough to use only an editorial yield", () => {
    const readiness = getRecipeReadiness(recipe("Pâte sucrée"), true);

    expect(readiness.blockers.map((blocker) => blocker.code)).not.toContain(
      "reference-servings",
    );
    expect(readiness.sections.ingredients).toBe(true);
  });

  test("still requires reference servings for a finished cake", () => {
    const readiness = getRecipeReadiness(recipe("Gâteau au chocolat", "30 min"), true);

    expect(readiness.blockers.map((blocker) => blocker.code)).toContain(
      "reference-servings",
    );
  });
});
