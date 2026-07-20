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

  test("localizes Julien's chocolate chip cookies as a piece-based recipe", () => {
    const source = recipes.find(
      (recipe) => recipe.slug === "cookies-aux-pepites-de-chocolat-et-fleur-de-sel",
    );
    expect(source).toBeDefined();

    const seeded = toSeedRecipe(source!);
    expect(seeded).toMatchObject({
      slug: "cookies-aux-pepites-de-chocolat-et-fleur-de-sel",
      heroImageUrl: "/images/recipes/cookies-aux-pepites-de-chocolat-et-fleur-de-sel.png",
      categories: ["dessert", "sucre"],
      legacyCategoryLabels: [],
    });
    expect(seeded.referenceServings).toBeUndefined();

    expect(seeded.translations.fr).toMatchObject({
      title: "Cookies aux pépites de chocolat et fleur de sel",
      author: "Julien",
      yieldLabel: "Environ 20 gros cookies",
      prepTime: "≈ 40 min",
      cookTime: "10 min",
      totalTime: "≈ 1 h",
      temperature: "180 °C",
      servings: null,
    });
    expect(seeded.translations.en).toMatchObject({
      title: "Chocolate Chip Cookies with Fleur de Sel",
      author: "Julien",
      description: "Large chocolate chip cookies with crisp edges, soft centers and a touch of fleur de sel.",
      yieldLabel: "About 20 large cookies",
      prepTime: "≈ 40 min",
      cookTime: "10 min",
      totalTime: "≈ 1 h",
      temperature: "180 °C",
      servings: null,
    });
    expect(seeded.translations.en.ingredients.map(({ name, notes }) => ({ name, notes }))).toEqual([
      { name: "butter", notes: "" },
      { name: "brown sugar", notes: "" },
      { name: "granulated sugar", notes: "" },
      { name: "flour", notes: "" },
      { name: "baking soda", notes: "optional" },
      { name: "baking powder", notes: "" },
      { name: "salt", notes: "" },
      { name: "large egg", notes: "" },
      { name: "vanilla bean", notes: "seeds only" },
      { name: "dark chocolate", notes: "roughly chopped" },
      { name: "fleur de sel", notes: "for sprinkling" },
    ]);
    expect(seeded.translations.en.sections.map(({ title }) => title)).toEqual([
      "Preparing the Dough",
      "Resting",
      "Baking",
      "Cooling",
    ]);
    expect(seeded.translations.en.sections.flatMap(({ steps }) => steps)).toEqual([
      "In a bowl, combine the flour, baking soda, baking powder and salt.",
      "Melt the butter over medium heat, then pour it into a large bowl.",
      "Add the brown sugar and granulated sugar to the melted butter, then mix until smooth.",
      "Mix in the egg and vanilla seeds until smooth and glossy.",
      "Add the dry ingredients in two batches with a wooden spoon, mixing only until incorporated.",
      "Add the roughly chopped dark chocolate and mix once more without overworking the dough.",
      "Cover the bowl and chill the dough for 30 min.",
      "Preheat the oven to 180 °C and line a baking sheet with parchment paper.",
      "Shape the dough into large balls with an ice cream scoop or tablespoon, spacing them well apart on the baking sheet.",
      "Sprinkle each ball with a small pinch of fleur de sel.",
      "Bake for 8 min, remove the baking sheet and tap it lightly on the counter to help the cookies spread.",
      "Bake for another 2 min, then tap the baking sheet again after removing it from the oven.",
      "Transfer the cookies to a rack and let them rest for at least 10 min before storing or serving.",
    ]);
  });

  test("localizes Louis's mayonnaise as a savory yield-only recipe", () => {
    const source = recipes.find((recipe) => recipe.slug === "mayonnaise");
    expect(source).toBeDefined();

    const seeded = toSeedRecipe(source!);
    expect(seeded).toMatchObject({
      slug: "mayonnaise",
      heroImageUrl: "/images/recipes/mayonnaise.png",
      categories: ["sale"],
      legacyCategoryLabels: [],
    });
    expect(seeded.referenceServings).toBeUndefined();

    expect(seeded.translations.fr).toMatchObject({
      title: "Mayonnaise",
      author: "Louis",
      yieldLabel: "Un petit bol",
      prepTime: "5 min",
      cookTime: "",
      totalTime: "5 min",
      servings: null,
    });
    expect(seeded.translations.fr.ingredients).toEqual([
      { name: "moutarde de Dijon", quantity: "2", unit: "c. à café", notes: "" },
      { name: "jaune d’œuf", quantity: "1", unit: "", notes: "" },
      { name: "huile de tournesol", quantity: "10", unit: "cl", notes: "" },
      { name: "vinaigre balsamique", quantity: "quelques gouttes", unit: "", notes: "" },
      { name: "sel", quantity: "", unit: "", notes: "à convenance" },
      { name: "poivre", quantity: "", unit: "", notes: "à convenance" },
    ]);
    expect(seeded.translations.fr.notes).toEqual([
      "Pour une mayonnaise bien fraîche, la laisser reposer 30 min au réfrigérateur avant de servir.",
    ]);

    expect(seeded.translations.en).toMatchObject({
      title: "Mayonnaise",
      author: "Louis",
      description: "Homemade Dijon mustard mayonnaise blended with sunflower oil and seasoned with balsamic vinegar.",
      yieldLabel: "One small bowl",
      prepTime: "5 min",
      cookTime: "",
      totalTime: "5 min",
      servings: null,
    });
    expect(seeded.translations.en.ingredients).toEqual([
      { name: "Dijon mustard", quantity: "2", unit: "tsp", notes: "" },
      { name: "egg yolk", quantity: "1", unit: "", notes: "" },
      { name: "sunflower oil", quantity: "10", unit: "cl", notes: "" },
      { name: "balsamic vinegar", quantity: "a few drops", unit: "", notes: "" },
      { name: "salt", quantity: "", unit: "", notes: "to taste" },
      { name: "pepper", quantity: "", unit: "", notes: "to taste" },
    ]);
    expect(seeded.translations.en.sections[0]?.steps).toEqual([
      "Place the Dijon mustard and egg yolk in the blender bowl, then blend.",
      "Keep blending while gradually pouring in the sunflower oil in a thin stream, until the mayonnaise is well emulsified.",
      "Add a few drops of balsamic vinegar, then season with salt and pepper to taste. Blend once more until smooth.",
    ]);
    expect(seeded.translations.en.notes).toEqual([
      "For a well-chilled mayonnaise, refrigerate it for 30 min before serving.",
    ]);
  });
});
