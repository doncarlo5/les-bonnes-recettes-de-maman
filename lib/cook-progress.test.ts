import { describe, expect, test } from "vitest";
import {
  createCookContentSignature,
  getCookProgressKey,
  parseCookProgress,
  readCookProgress,
  removeCookProgress,
  writeCookProgress,
  type CookProgressV1,
} from "./cook-progress";

const content = {
  ingredients: [{ id: "flour", name: "Farine", quantity: "100", unit: "g", notes: "" }],
  sections: [{
    title: "Pâte",
    steps: [
      { id: "mix", text: "Mélanger", ingredientUses: [] },
      { id: "bake", text: "Cuire", ingredientUses: [] },
    ],
  }],
  subRecipes: [],
};

describe("recipe cooking progress", () => {
  test("degrades when persistent storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    };
    const progress: CookProgressV1 = {
      version: 1,
      contentSignature: createCookContentSignature(content),
      sectionIndex: 0,
      stepIndex: 0,
      checkedIngredientIds: [],
      updatedAt: 1,
    };

    expect(readCookProgress(storage, "key", content)).toBeNull();
    expect(writeCookProgress(storage, "key", progress)).toBe(false);
    expect(removeCookProgress(storage, "key")).toBe(false);
  });

  test("uses independent versioned keys for each locale", () => {
    expect(getCookProgressKey("fr", "tarte")).toBe("recipe-cook:v1:fr:tarte");
    expect(getCookProgressKey("en", "tarte")).toBe("recipe-cook:v1:en:tarte");
  });
  test("restores valid progress for unchanged published content", () => {
    const contentSignature = createCookContentSignature(content);
    const saved: CookProgressV1 = {
      version: 1,
      contentSignature,
      sectionIndex: 0,
      stepIndex: 1,
      checkedIngredientIds: ["main:0"],
      updatedAt: 42,
    };

    expect(parseCookProgress(JSON.stringify(saved), content)).toEqual(saved);
  });

  test("rejects progress when published content has changed", () => {
    const saved = {
      version: 1,
      contentSignature: createCookContentSignature(content),
      sectionIndex: 0,
      stepIndex: 1,
      checkedIngredientIds: [],
      updatedAt: 42,
    };
    const changed = {
      ...content,
      sections: [{
        title: "Pâte",
        steps: [{ id: "mix", text: "Mélanger", ingredientUses: [] }],
      }],
    };

    expect(parseCookProgress(JSON.stringify(saved), changed)).toBeNull();
  });

  test("rejects corrupt and out-of-range progress", () => {
    expect(parseCookProgress("not-json", content)).toBeNull();
    expect(
      parseCookProgress(
        JSON.stringify({
          version: 1,
          contentSignature: createCookContentSignature(content),
          sectionIndex: 4,
          stepIndex: 0,
          checkedIngredientIds: [],
          updatedAt: 42,
        }),
        content,
      ),
    ).toBeNull();
  });
});
