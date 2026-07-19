import { describe, expect, test } from "vitest";
import { backfillYieldLabels, resolveYieldLabel } from "./recipe-yield";

describe("recipe yield labels", () => {
  test.each([
    ["fr", "gateau-aux-pommes", { quantity: 4, unit: "personnes" }, "4 personnes"],
    ["fr", "vacherin", { quantity: 8, unit: "à 10 personnes" }, "8 à 10 personnes"],
    ["fr", "cake-d-ete-tout-vert", { quantity: 1, unit: "moule tablette ou 12 mini cakes" }, "1 moule tablette ou 12 mini cakes"],
    ["fr", "gougeres", { quantity: 20, unit: "environ" }, "Environ 20 gougères"],
    ["en", "gougeres", { quantity: 20, unit: "about" }, "About 20 gougères"],
  ] as const)("converts %s legacy yield for %s", (locale, slug, servings, expected) => {
    expect(resolveYieldLabel({ locale, slug, servings })).toBe(expected);
  });

  test("prefers the localized editorial label", () => {
    expect(resolveYieldLabel({
      locale: "fr",
      slug: "gougeres",
      yieldLabel: "Une vingtaine de gougères",
      servings: { quantity: 20, unit: "environ" },
    })).toBe("Une vingtaine de gougères");
  });

  test("an intentionally empty editorial label clears a legacy yield", () => {
    expect(resolveYieldLabel({
      locale: "fr",
      slug: "gougeres",
      yieldLabel: "",
      servings: { quantity: 20, unit: "environ" },
    })).toBe("");
  });

  test("keeps an absent yield empty", () => {
    expect(resolveYieldLabel({ locale: "fr", slug: "tiramisu", servings: null })).toBe("");
  });

  test("backfills localized labels once and remains idempotent", () => {
    const legacy = {
      fr: { servings: { quantity: 20, unit: "environ" } },
      en: { servings: { quantity: 20, unit: "about" } },
    };
    const migrated = backfillYieldLabels("gougeres", legacy);
    expect(migrated).toMatchObject({
      fr: { yieldLabel: "Environ 20 gougères" },
      en: { yieldLabel: "About 20 gougères" },
    });
    expect(backfillYieldLabels("gougeres", migrated)).toBe(migrated);
  });
});
