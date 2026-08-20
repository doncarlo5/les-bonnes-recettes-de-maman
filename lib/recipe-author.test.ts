import { describe, expect, it } from "vitest";
import { formatRecipeByline, startsWithFrenchVowel } from "./recipe-author";

describe("startsWithFrenchVowel", () => {
  it.each(["Alexia", "Élodie", "Ève", "Îris", "Océane", "Ümit", "Yves"])(
    "detects the vowel at the start of %s",
    (author) => {
      expect(startsWithFrenchVowel(author)).toBe(true);
    },
  );

  it("ignores leading spaces", () => {
    expect(startsWithFrenchVowel("  Agnès")).toBe(true);
  });

  it("does not treat a consonant as a vowel", () => {
    expect(startsWithFrenchVowel("Maman")).toBe(false);
  });
});

describe("formatRecipeByline", () => {
  it("contracts de before a French vowel", () => {
    expect(formatRecipeByline("fr", "Recette de", "Alexia")).toBe(
      "Recette d’Alexia",
    );
  });

  it("keeps de before a French consonant", () => {
    expect(formatRecipeByline("fr", "Recette de", "Maman")).toBe(
      "Recette de Maman",
    );
  });

  it("does not apply French contraction to English", () => {
    expect(formatRecipeByline("en", "Recipe by", "Alexia")).toBe(
      "Recipe by Alexia",
    );
  });
});
