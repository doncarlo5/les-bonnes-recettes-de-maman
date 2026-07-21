import { describe, expect, test } from "vitest";
import {
  backfillLocalizedStepIngredients,
  enrichLocalizedStepIngredients,
} from "./recipe-step-migration";

describe("step ingredient migration", () => {
  test("backfills legacy content and is idempotent", () => {
    const legacy = {
      ingredients: [{ name: "Farine", quantity: "200", unit: "g", notes: "" }],
      sections: [{ title: "Préparation", steps: ["Mélanger"] }],
      subRecipes: [
        {
          title: "Crème",
          ingredients: [
            { name: "Lait", quantity: "10", unit: "cl", notes: "" },
          ],
        },
      ],
    };
    const migrated = backfillLocalizedStepIngredients(legacy);
    expect(migrated.ingredients[0].id).toBe("ingredient-main-0");
    expect(migrated.sections[0].stepDetails).toEqual([
      {
        id: "step-0-0",
        text: "Mélanger",
        ingredientUses: [],
      },
    ]);
    expect(migrated.subRecipes[0].ingredients[0].id).toBe("ingredient-sub-0-0");
    expect(backfillLocalizedStepIngredients(migrated)).toBe(migrated);
  });
});

describe("enrichLocalizedStepIngredients", () => {
  test("associates specific mentions without confusing ingredient variants", () => {
    const localized = {
      ingredients: [
        { name: "huile de tournesol", quantity: "8", unit: "cl", notes: "" },
        { name: "huile d’olive", quantity: "2", unit: "c. à s.", notes: "" },
        { name: "sucre", quantity: "100", unit: "g", notes: "" },
        { name: "sucre glace", quantity: "50", unit: "g", notes: "" },
      ],
      sections: [
        {
          title: "Préparation",
          steps: [
            "Faire revenir dans l’huile d’olive.",
            "Ajouter le sucre glace.",
          ],
        },
      ],
      subRecipes: [],
    };

    const enriched = enrichLocalizedStepIngredients(localized);

    expect(enriched.sections[0].stepDetails?.[0].ingredientUses).toEqual([
      { ingredientId: "ingredient-main-1" },
    ]);
    expect(enriched.sections[0].stepDetails?.[1].ingredientUses).toEqual([
      { ingredientId: "ingredient-main-3" },
    ]);
  });

  test("distributes duplicate ingredients across their successive mentions", () => {
    const localized = {
      ingredients: [
        { name: "sucre", quantity: "100", unit: "g", notes: "" },
        { name: "sucre", quantity: "50", unit: "g", notes: "" },
      ],
      sections: [
        { title: "Pâte", steps: ["Ajouter le sucre."] },
        {
          title: "Crème",
          steps: ["Mélanger avec le sucre."],
        },
      ],
      subRecipes: [],
    };

    const enriched = enrichLocalizedStepIngredients(localized);

    expect(
      enriched.sections[0].stepDetails?.[0].ingredientUses[0].ingredientId,
    ).toBe("ingredient-main-0");
    expect(
      enriched.sections[1].stepDetails?.[0].ingredientUses[0].ingredientId,
    ).toBe("ingredient-main-1");
    expect(enrichLocalizedStepIngredients(enriched)).toBe(enriched);
  });

  test("never overwrites an editorial association", () => {
    const migrated = backfillLocalizedStepIngredients({
      ingredients: [
        { id: "flour", name: "farine", quantity: "100", unit: "g", notes: "" },
      ],
      sections: [
        {
          title: "Préparation",
          steps: ["Ajouter la farine."],
          stepDetails: [
            {
              id: "mix",
              text: "Ajouter la farine.",
              ingredientUses: [{ ingredientId: "manual" }],
            },
          ],
        },
      ],
      subRecipes: [],
    });
    expect(enrichLocalizedStepIngredients(migrated)).toBe(migrated);
  });
});
