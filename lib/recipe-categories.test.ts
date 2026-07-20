import { describe, expect, it } from "vitest";
import {
  resolveRecipeCategories,
  splitRecipeCategoryLabels,
  toLegacyTags,
} from "./recipe-categories";

describe("recipe categories", () => {
  it("separates canonical categories from legacy labels", () => {
    expect(splitRecipeCategoryLabels(["dessert", " ancien ", "sale", "dessert"])).toEqual({
      categories: ["dessert", "sale"],
      legacyCategoryLabels: ["ancien"],
    });
  });

  it("merges migrated fields with legacy tags without losing labels", () => {
    expect(resolveRecipeCategories({
      categories: ["plat"],
      legacyCategoryLabels: ["famille"],
      tags: ["dessert"],
    })).toEqual({ categories: ["plat", "dessert"], legacyCategoryLabels: ["famille"] });
  });

  it("keeps a rollback-compatible tags representation", () => {
    expect(toLegacyTags(["sucre"], ["goûter"])).toEqual(["sucre", "goûter"]);
  });
});
