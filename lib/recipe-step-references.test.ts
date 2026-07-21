import { describe, expect, test } from "vitest";
import {
  countIngredientReferences,
  removeIngredientReferences,
} from "./recipe-step-references";

const sections = [
  {
    title: "Préparation",
    steps: [
      {
        id: "mix",
        text: "Mélanger",
        ingredientUses: [{ ingredientId: "flour" }, { ingredientId: "milk" }],
      },
    ],
  },
];

describe("step ingredient references", () => {
  test("counts and removes every affected step reference", () => {
    expect(countIngredientReferences(sections, ["flour"])).toBe(1);
    expect(countIngredientReferences(sections, ["flour", "milk"])).toBe(1);
    expect(
      removeIngredientReferences(sections, ["flour"])[0].steps[0]
        .ingredientUses,
    ).toEqual([{ ingredientId: "milk" }]);
  });
});
