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
    restTime: "",
    totalTime: "15 min",
    timeLabel: "15 min",
    temperature: "",
    equipment: [],
    ingredients: [{ name: "farine", quantity: "500", unit: "g", notes: "" }],
    sections: [{ title: "Préparation", steps: ["Mélanger."] }],
    subRecipes: [],
    notes: [],
  };

  return {
    defaultLocale: "fr",
    relatedRecipeSlugs: [],
    translations: { fr: localized, en: { ...localized, title: "Dough" } },
    categories: [],
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
    const cake = recipe("Gâteau au chocolat", "30 min");
    cake.translations.fr.yieldLabel = "";
    cake.translations.en.yieldLabel = "";
    const readiness = getRecipeReadiness(cake, true);

    expect(readiness.blockers).toContainEqual(
      expect.objectContaining({
        code: "reference-servings",
        label: "Indique le rendement ou les portions de référence.",
      }),
    );
  });

  test("allows an uncooked drink to use only an editorial yield", () => {
    const drink = recipe("Soupe de champagne");
    drink.translations.fr.yieldLabel = "Environ 1 litre";
    drink.translations.en.yieldLabel = "About 1 litre";

    const readiness = getRecipeReadiness(drink, true);

    expect(readiness.blockers.map((blocker) => blocker.code)).not.toContain(
      "reference-servings",
    );
    expect(readiness.sections.ingredients).toBe(true);
  });

  test("allows baked pieces to use only an editorial yield", () => {
    const cookies = recipe("Cookies aux pépites de chocolat", "10 min");
    cookies.translations.fr.yieldLabel = "Environ 20 gros cookies";
    cookies.translations.en.yieldLabel = "About 20 large cookies";

    const readiness = getRecipeReadiness(cookies, true);

    expect(readiness.blockers.map((blocker) => blocker.code)).not.toContain(
      "reference-servings",
    );
    expect(readiness.sections.ingredients).toBe(true);
  });
});
