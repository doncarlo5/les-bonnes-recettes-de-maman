import { describe, expect, test } from "vitest";
import rawRecipes from "./recettes.json";
import {
  localizeRecipe,
  toSeedRecipe,
  type SourceRecipe,
} from "./recipeTranslations";

const recipes = rawRecipes as SourceRecipe[];

describe("recipe yield localization", () => {
  test("keeps every legacy yield without losing its wording", () => {
    for (const recipe of recipes) {
      const french = localizeRecipe(recipe, "fr");
      const english = localizeRecipe(recipe, "en");

      expect(french.yieldLabel).toBeTypeOf("string");
      expect(english.yieldLabel).toBeTypeOf("string");
      if (recipe.yieldLabel) {
        expect(french.yieldLabel).toBe(recipe.yieldLabel);
      } else if (recipe.servings && recipe.slug !== "gougeres") {
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
    const source = recipes.find(
      (recipe) => recipe.slug === "soupe-de-champagne",
    );
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
    expect(
      seeded.translations.fr.ingredients.map(({ name, quantity, unit }) => ({
        name,
        quantity,
        unit,
      })),
    ).toEqual([
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
    const canadouRange = liquidIngredients[3]!.quantity
      .split(" à ")
      .map(Number);
    expect(canadouRange.map((quantity) => fixedVolume + quantity)).toEqual([
      100, 102,
    ]);

    expect(seeded.translations.en).toMatchObject({
      title: "Champagne Punch",
      author: "Fabrice",
      yieldLabel: "About 1 litre",
      prepTime: "5 min",
      servings: null,
    });
    expect(
      seeded.translations.en.ingredients.map(({ name, quantity }) => ({
        name,
        quantity,
      })),
    ).toEqual([
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
      (recipe) =>
        recipe.slug === "cookies-aux-pepites-de-chocolat-et-fleur-de-sel",
    );
    expect(source).toBeDefined();

    const seeded = toSeedRecipe(source!);
    expect(seeded).toMatchObject({
      slug: "cookies-aux-pepites-de-chocolat-et-fleur-de-sel",
      heroImageUrl:
        "/images/recipes/cookies-aux-pepites-de-chocolat-et-fleur-de-sel.png",
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
      description:
        "Large chocolate chip cookies with crisp edges, soft centers and a touch of fleur de sel.",
      yieldLabel: "About 20 large cookies",
      prepTime: "≈ 40 min",
      cookTime: "10 min",
      totalTime: "≈ 1 h",
      temperature: "180 °C",
      servings: null,
    });
    expect(
      seeded.translations.en.ingredients.map(({ name, notes }) => ({
        name,
        notes,
      })),
    ).toEqual([
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
    expect(
      seeded.translations.en.sections.flatMap(({ steps }) => steps),
    ).toEqual([
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

  test("localizes Mary McHale's banana bread as one metric loaf", () => {
    const source = recipes.find(
      (recipe) => recipe.slug === "banana-bread-du-kona-inn",
    );
    expect(source).toBeDefined();

    const seeded = toSeedRecipe(source!);
    expect(seeded.referenceServings).toBeUndefined();
    expect(seeded.translations.fr).toMatchObject({
      title: "Banana bread",
      author: "Mary McHale",
      yieldLabel: "1 cake",
      servings: null,
      prepTime: "20 min",
      cookTime: "45 à 60 min",
      temperature: "175 °C",
    });
    expect(
      seeded.translations.fr.ingredients.map(
        ({ id: _id, ...ingredient }) => ingredient,
      ),
    ).toEqual([
      { name: "sucre blanc", quantity: "200", unit: "g", notes: "" },
      { name: "beurre", quantity: "115", unit: "g", notes: "ramolli" },
      {
        name: "bananes bien mûres",
        quantity: "325 à 350",
        unit: "g",
        notes: "écrasées, environ 3 à 4 bananes selon leur taille",
      },
      { name: "œufs", quantity: "2", unit: "", notes: "bien battus" },
      { name: "farine T45", quantity: "130", unit: "g", notes: "" },
      { name: "Maïzena", quantity: "15", unit: "g", notes: "" },
      { name: "bicarbonate de soude", quantity: "5", unit: "g", notes: "" },
      { name: "sel", quantity: "3", unit: "g", notes: "" },
      {
        name: "noix de pécan hachées",
        quantity: "30",
        unit: "g",
        notes: "première variante facultative",
      },
      {
        name: "cannelle",
        quantity: "1",
        unit: "pincée",
        notes: "première variante facultative",
      },
      {
        name: "noix de pécan hachées",
        quantity: "60",
        unit: "g",
        notes: "variante avec garniture facultative",
      },
      {
        name: "cassonade foncée",
        quantity: "25",
        unit: "g",
        notes: "variante avec garniture facultative",
      },
      {
        name: "cannelle",
        quantity: "4",
        unit: "g",
        notes: "variante avec garniture facultative",
      },
    ]);
    expect(seeded.translations.fr.subRecipes).toEqual([]);

    expect(seeded.translations.en).toMatchObject({
      title: "Banana Bread",
      author: "Mary McHale",
      yieldLabel: "1 loaf",
      servings: null,
    });
    expect(
      seeded.translations.en.ingredients.map(
        ({ id: _id, ...ingredient }) => ingredient,
      ),
    ).toEqual([
      { name: "white sugar", quantity: "200", unit: "g", notes: "" },
      { name: "butter", quantity: "115", unit: "g", notes: "softened" },
      {
        name: "very ripe bananas",
        quantity: "325 to 350",
        unit: "g",
        notes: "mashed, about 3 to 4 bananas depending on their size",
      },
      { name: "eggs", quantity: "2", unit: "", notes: "well beaten" },
      { name: "T45 flour", quantity: "130", unit: "g", notes: "" },
      { name: "cornstarch", quantity: "15", unit: "g", notes: "" },
      { name: "baking soda", quantity: "5", unit: "g", notes: "" },
      { name: "salt", quantity: "3", unit: "g", notes: "" },
      {
        name: "chopped pecans",
        quantity: "30",
        unit: "g",
        notes: "first optional variation",
      },
      {
        name: "cinnamon",
        quantity: "1",
        unit: "pinch",
        notes: "first optional variation",
      },
      {
        name: "chopped pecans",
        quantity: "60",
        unit: "g",
        notes: "optional filling variation",
      },
      {
        name: "dark brown sugar",
        quantity: "25",
        unit: "g",
        notes: "optional filling variation",
      },
      {
        name: "cinnamon",
        quantity: "4",
        unit: "g",
        notes: "optional filling variation",
      },
    ]);
    expect(seeded.translations.en.subRecipes).toEqual([]);
    expect(seeded.translations.en.sections.map(({ title }) => title)).toEqual([
      "Preparation",
      "Optional Batter Addition",
      "Baking",
      "Cinnamon and Pecan Filling Variation",
      "Storage",
    ]);
    expect(
      seeded.translations.en.sections.flatMap(({ steps }) => steps),
    ).toEqual([
      "Preheat the oven to 175 °C.",
      "Beat the softened butter and sugar until light and fluffy.",
      "Add the mashed bananas and beaten eggs, then mix until smooth.",
      "In another bowl, combine the T45 flour, cornstarch, baking soda and salt. Sift the dry ingredients, ideally several times, then fold them into the banana mixture without overmixing.",
      "For the first variation, fold the chopped pecans and pinch of cinnamon into the batter. Do not combine this option with the filling variation.",
      "Pour the batter into 1 lightly greased loaf pan.",
      "Bake for 45 to 60 min, until the center is firm and a knife or toothpick inserted into it comes out clean or almost clean.",
      "Let cool in the pan for 10 min, then unmold onto a rack.",
      "For this variation, omit the pecans and cinnamon intended to be mixed directly into the batter.",
      "Mix the chopped pecans, dark brown sugar and cinnamon.",
      "Pour half the batter into the pan, sprinkle with some of the mixture, then add the remaining batter.",
      "If any mixture remains, sprinkle it on top and press it lightly into the batter.",
      "This banana bread freezes very well.",
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
    expect(
      seeded.translations.fr.ingredients.map(
        ({ id: _id, ...ingredient }) => ingredient,
      ),
    ).toEqual([
      {
        name: "moutarde de Dijon",
        quantity: "2",
        unit: "c. à café",
        notes: "",
      },
      { name: "jaune d’œuf", quantity: "1", unit: "", notes: "" },
      { name: "huile de tournesol", quantity: "10", unit: "cl", notes: "" },
      {
        name: "vinaigre balsamique",
        quantity: "quelques gouttes",
        unit: "",
        notes: "",
      },
      { name: "sel", quantity: "", unit: "", notes: "à convenance" },
      { name: "poivre", quantity: "", unit: "", notes: "à convenance" },
    ]);
    expect(seeded.translations.fr.notes).toEqual([
      "Pour une mayonnaise bien fraîche, la laisser reposer 30 min au réfrigérateur avant de servir.",
    ]);

    expect(seeded.translations.en).toMatchObject({
      title: "Mayonnaise",
      author: "Louis",
      description:
        "Homemade Dijon mustard mayonnaise blended with sunflower oil and seasoned with balsamic vinegar.",
      yieldLabel: "One small bowl",
      prepTime: "5 min",
      cookTime: "",
      totalTime: "5 min",
      servings: null,
    });
    expect(
      seeded.translations.en.ingredients.map(
        ({ id: _id, ...ingredient }) => ingredient,
      ),
    ).toEqual([
      { name: "Dijon mustard", quantity: "2", unit: "tsp", notes: "" },
      { name: "egg yolk", quantity: "1", unit: "", notes: "" },
      { name: "sunflower oil", quantity: "10", unit: "cl", notes: "" },
      {
        name: "balsamic vinegar",
        quantity: "a few drops",
        unit: "",
        notes: "",
      },
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

  test("seeds Marmiton-style metadata and structured recipe links", () => {
    const source = recipes.find((recipe) => recipe.slug === "pain-de-poisson");
    expect(source).toBeDefined();

    const seeded = toSeedRecipe(source!);
    expect(seeded.relatedRecipeSlugs).toEqual(["mayonnaise"]);
    expect(seeded.translations.fr).toMatchObject({
      restTime: "Jusqu’à complet refroidissement",
      equipment: ["1 moule à cake", "1 plat pour bain-marie"],
    });
    expect(seeded.translations.en).toMatchObject({
      restTime: "Until completely cool",
      equipment: ["1 loaf pan", "1 roasting dish for the water bath"],
    });
  });
});
