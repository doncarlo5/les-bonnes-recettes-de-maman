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

  test("localizes Fabrice's champagne punch without changing its brands or quantities", () => {
    const source = recipes.find((recipe) => recipe.slug === "soupe-de-champagne");
    expect(source).toBeDefined();

    const seeded = toSeedRecipe(source!);
    expect(seeded.tags).toEqual(["sucre"]);
    expect(seeded.heroImageUrl).toBe("/images/recipes/soupe-de-champagne.png");
    expect(seeded.referenceServings).toBeUndefined();

    expect(seeded.translations.fr).toMatchObject({
      title: "Soupe de champagne",
      author: "Fabrice",
      yieldLabel: "Environ 1 litre",
      prepTime: "5 min",
      servings: null,
    });
    expect(seeded.translations.fr.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit }))).toEqual([
      { name: "crémant de Loire", quantity: "75", unit: "cl" },
      { name: "Cointreau", quantity: "10", unit: "cl" },
      { name: "Pulco Citron", quantity: "10", unit: "cl" },
      { name: "Canadou", quantity: "5 à 7", unit: "cl" },
      { name: "glaçons", quantity: "", unit: "" },
    ]);
    expect(seeded.translations.fr.sections[0]?.steps).toEqual([
      "Placer tous les ingrédients au réfrigérateur à l’avance afin qu’ils soient bien frais.",
      "Dans un saladier, mélanger le Cointreau, le Pulco Citron et le Canadou.",
      "Au dernier moment, ajouter le crémant de Loire.",
      "Ajouter des glaçons, remuer délicatement et servir aussitôt, très frais.",
    ]);

    const liquidIngredients = source!.ingredients.slice(0, 4);
    const fixedVolume = liquidIngredients
      .slice(0, 3)
      .reduce((total, ingredient) => total + Number(ingredient.quantity), 0);
    const canadouRange = liquidIngredients[3]!.quantity.split(" à ").map(Number);
    expect(canadouRange.map((quantity) => fixedVolume + quantity)).toEqual([100, 102]);

    expect(seeded.translations.en).toMatchObject({
      title: "Champagne Punch",
      author: "Fabrice",
      yieldLabel: "About 1 litre",
      prepTime: "5 min",
      servings: null,
    });
    expect(seeded.translations.en.ingredients.map(({ name, quantity }) => ({ name, quantity }))).toEqual([
      { name: "Loire Valley Crémant", quantity: "75" },
      { name: "Cointreau", quantity: "10" },
      { name: "Pulco Citron", quantity: "10" },
      { name: "Canadou", quantity: "5 to 7" },
      { name: "ice cubes", quantity: "" },
    ]);
    expect(seeded.translations.en.sections[0]?.steps).toEqual([
      "Chill all the ingredients in advance so they are very cold.",
      "In a punch bowl, combine the Cointreau, Pulco Citron and Canadou.",
      "At the last moment, add the Loire Valley Crémant.",
      "Add ice cubes, stir gently and serve immediately, very cold.",
    ]);
  });
});
