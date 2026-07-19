import { describe, expect, test } from "vitest";
import rawRecipes from "./recettes.json";
import { localizeRecipe, toSeedRecipe, type SourceRecipe } from "./recipeTranslations";

const recipes = rawRecipes as SourceRecipe[];

describe("recipe yield localization", () => {
  test("keeps every legacy yield without losing its wording", () => {
    for (const recipe of recipes) {
      const french = localizeRecipe(recipe, "fr");
      const english = localizeRecipe(recipe, "en");

      expect(french.yieldLabel).toBeTypeOf("string");
      expect(english.yieldLabel).toBeTypeOf("string");
      if (recipe.servings && recipe.slug !== "gougeres") {
        expect(french.yieldLabel).toBe(
          `${recipe.servings.quantity} ${recipe.servings.unit}`.trim(),
        );
      }
    }
  });

  test("corrects the localized Gougères yield in seeded storage", () => {
    const gougeres = recipes.find((recipe) => recipe.slug === "gougeres");
    expect(gougeres).toBeDefined();

    const seeded = toSeedRecipe(gougeres!);
    expect(seeded.translations.fr.yieldLabel).toBe("Environ 20 gougères");
    expect(seeded.translations.en.yieldLabel).toBe("About 20 gougères");
  });
});
