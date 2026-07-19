import { describe, expect, test } from "vitest";
import {
  formatScaledIngredientQuantity,
  parseSelectedServings,
  resolveReferenceServings,
} from "./recipe-servings";

describe("recipe servings", () => {
  test.each([
    ["100", 1.5, "fr", "150"],
    ["12,5", 2, "fr", "25"],
    ["1/2", 3, "fr", "1,5"],
    ["1 1/3", 1.5, "fr", "2"],
    ["2 à 3", 1.5, "fr", "3 à 4,5"],
    ["2-3", 2, "fr", "4-6"],
    ["2–3", 2, "fr", "4–6"],
    ["1/3", 1, "fr", "1/3"],
    ["100", 1 / 3, "fr", "33,33"],
    ["1.5", 2, "en", "3"],
    ["2 to 3", 1.5, "en", "3 to 4.5"],
  ] as const)("scales %s by %s in %s", (quantity, factor, locale, expected) => {
    expect(formatScaledIngredientQuantity(quantity, factor, locale)).toBe(expected);
  });

  test.each(["", "un peu", "quelques", "poids de 2 1/2 œufs"])(
    "keeps the editorial quantity %j unchanged",
    (quantity) => {
      expect(formatScaledIngredientQuantity(quantity, 2, "fr")).toBe(quantity);
    },
  );

  test("accepts only whole selected servings between 1 and 50", () => {
    expect(parseSelectedServings("12")).toBe(12);
    expect(parseSelectedServings("0")).toBeNull();
    expect(parseSelectedServings("12.5")).toBeNull();
    expect(parseSelectedServings(["12", "13"])).toBeNull();
    expect(parseSelectedServings(undefined)).toBeNull();
  });

  test("uses only an unambiguous legacy person count as a reference", () => {
    expect(resolveReferenceServings(undefined, { quantity: 6, unit: "personnes" })).toBe(6);
    expect(resolveReferenceServings(undefined, { quantity: 6, unit: "servings" })).toBe(6);
    expect(resolveReferenceServings(undefined, { quantity: 8, unit: "à 10 personnes" })).toBeUndefined();
    expect(resolveReferenceServings(undefined, { quantity: 2, unit: "cakes" })).toBeUndefined();
    expect(resolveReferenceServings(4, { quantity: 6, unit: "personnes" })).toBe(4);
  });
});
