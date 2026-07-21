import { describe, expect, test } from "vitest";
import { backfillLocalizedStepIngredients } from "./recipe-step-migration";

describe("step ingredient migration", () => {
  test("backfills legacy content and is idempotent", () => {
    const legacy = {
      ingredients: [{ name: "Farine", quantity: "200", unit: "g", notes: "" }],
      sections: [{ title: "Préparation", steps: ["Mélanger"] }],
      subRecipes: [{
        title: "Crème",
        ingredients: [{ name: "Lait", quantity: "10", unit: "cl", notes: "" }],
      }],
    };
    const migrated = backfillLocalizedStepIngredients(legacy);
    expect(migrated.ingredients[0].id).toBe("ingredient-main-0");
    expect(migrated.sections[0].stepDetails).toEqual([{
      id: "step-0-0",
      text: "Mélanger",
      ingredientUses: [],
    }]);
    expect(migrated.subRecipes[0].ingredients[0].id).toBe("ingredient-sub-0-0");
    expect(backfillLocalizedStepIngredients(migrated)).toBe(migrated);
  });
});
