/// <reference types="vite/client" />

import { readdirSync } from "node:fs";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { recipeCatalog } from "./recipeCatalog";
import { recipeTranslationFiles } from "./recipeTranslations/index";
import { applyRecipeTranslation, recipeStructure } from "./recipeLocales";

const modules = import.meta.glob("./**/*.ts");
const password = "test-password";

async function publishedLasagnes() {
  const t = convexTest(schema, modules);
  await t.mutation(api.recipes.syncProductionRecipe, { adminPassword: password, slug: "lasagnes" });
  return t;
}

describe("Brazilian Portuguese and Belgian Dutch recipe translations", () => {
  test("keeps the generated index aligned with every translation file", () => {
    const filenames = readdirSync(new URL("./recipeTranslations/recipes", import.meta.url))
      .filter((filename) => filename.endsWith(".json"))
      .sort()
      .map((filename) => filename.replace(/\.json$/, ""));
    expect(Object.keys(recipeTranslationFiles)).toEqual(filenames);
  });

  test("every catalog recipe is translated and its translation matches the French structure", async () => {
    const t = convexTest(schema, modules);
    for (const recipe of recipeCatalog) {
      expect(recipeTranslationFiles[recipe.slug], recipe.slug).toBeDefined();
      await t.mutation(api.recipes.syncProductionRecipe, { adminPassword: password, slug: recipe.slug });
    }
    await expect(t.mutation(internal.recipeTranslations.sync.apply, {})).resolves.toMatchObject({
      updated: recipeCatalog.length,
    });
  });

  test("serves each language and falls back when the French recipe changes shape", async () => {
    const t = await publishedLasagnes();
    await t.mutation(internal.recipeTranslations.sync.apply, { slug: "lasagnes" });

    const pt = await t.query(api.recipes.getBySlug, { locale: "pt-br", slug: "lasagnes" });
    const nl = await t.query(api.recipes.getBySlug, { locale: "nl-be", slug: "lasagnes" });
    const fr = await t.query(api.recipes.getBySlug, { locale: "fr", slug: "lasagnes" });
    expect(pt?.title).toBe(recipeTranslationFiles.lasagnes.translations["pt-br"].title);
    expect(nl?.title).toBe(recipeTranslationFiles.lasagnes.translations["nl-be"].title);
    // Wording changes, quantities and step links stay those of the French recipe.
    expect(pt?.ingredients.map((item) => item.id)).toEqual(fr?.ingredients.map((item) => item.id));
    expect(pt?.sections.map((section) => section.stepDetails.map((step) => step.ingredientUses)))
      .toEqual(fr?.sections.map((section) => section.stepDetails.map((step) => step.ingredientUses)));

    // An admin adds an ingredient in French: the stale translation is no longer shown.
    await t.run(async (ctx) => {
      const recipe = await ctx.db.query("recipes").withIndex("by_slug", (q) => q.eq("slug", "lasagnes")).unique();
      const french = recipe!.translations.fr;
      await ctx.db.patch(recipe!._id, {
        translations: {
          ...recipe!.translations,
          fr: { ...french, ingredients: [...french.ingredients, { id: "ingredient-new", name: "basilic", quantity: "", unit: "", notes: "" }] },
        },
      });
    });
    const english = await t.query(api.recipes.getBySlug, { locale: "en", slug: "lasagnes" });
    const french = await t.query(api.recipes.getBySlug, { locale: "fr", slug: "lasagnes" });
    expect((await t.query(api.recipes.getBySlug, { locale: "pt-br", slug: "lasagnes" }))?.title).toBe(english?.title);
    expect((await t.query(api.recipes.getBySlug, { locale: "nl-be", slug: "lasagnes" }))?.title).toBe(french?.title);
  });

  test("rejects a translation that misses a step and applies nothing", async () => {
    const t = await publishedLasagnes();
    const french = await t.run(async (ctx) =>
      (await ctx.db.query("recipes").withIndex("by_slug", (q) => q.eq("slug", "lasagnes")).unique())!.translations.fr,
    );
    const text = structuredClone(recipeTranslationFiles.lasagnes.translations["pt-br"]);
    const [firstStep] = Object.keys(text.sections[0].steps);
    delete text.sections[0].steps[firstStep];
    expect(() => applyRecipeTranslation(french, text, "lasagnes.pt-br")).toThrow(firstStep);

    const translated = applyRecipeTranslation(
      french,
      recipeTranslationFiles.lasagnes.translations["pt-br"],
      "lasagnes.pt-br",
    );
    expect(recipeStructure(translated)).toBe(recipeStructure(french));
  });
});
