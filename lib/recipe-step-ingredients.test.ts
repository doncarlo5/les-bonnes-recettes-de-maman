import { describe, expect, test } from "vitest";
import { resolveStepIngredients } from "./recipe-step-ingredients";

const recipe = {
  ingredients: [
    { id: "flour", name: "farine", quantity: "200", unit: "g", notes: "" },
    { id: "sugar", name: "sucre", quantity: "100", unit: "g", notes: "" },
  ],
  subRecipes: [
    {
      title: "Crème",
      ingredients: [
        { id: "milk", name: "lait", quantity: "100", unit: "ml", notes: "" },
      ],
    },
  ],
};

describe("step ingredients", () => {
  test("resolves global, overridden, textual, and sub-recipe quantities", () => {
    expect(
      resolveStepIngredients(
        recipe,
        [
          { ingredientId: "flour" },
          { ingredientId: "sugar", amount: { quantity: "50", unit: "g" } },
          { ingredientId: "milk", amount: { quantity: "la moitié", unit: "" } },
          { ingredientId: "missing" },
        ],
        1.5,
        "fr",
      ),
    ).toEqual([
      { id: "flour", name: "farine", amount: "300 g", groupTitle: undefined },
      { id: "sugar", name: "sucre", amount: "75 g", groupTitle: undefined },
      { id: "milk", name: "lait", amount: "la moitié", groupTitle: "Crème" },
    ]);
  });
});
