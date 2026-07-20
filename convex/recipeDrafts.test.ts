/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import type { RecipeCategory } from "../lib/recipe-categories";

const modules = import.meta.glob("./**/*.ts");
const password = "test-password";

function recipe(title = "Tarte mobile") {
  const localized = {
    title,
    author: "Maman",
    description: "Une recette prête à publier.",
    yieldLabel: "6 personnes",
    prepTime: "20 min",
    cookTime: "30 min",
    totalTime: "50 min",
    timeLabel: "50 min",
    temperature: "180 °C",
    ingredients: [{ name: "Farine", quantity: "200", unit: "g", notes: "" }],
    sections: [{ title: "Préparation", steps: ["Mélanger puis cuire."] }],
    subRecipes: [],
    notes: [],
  };

  return {
    defaultLocale: "fr" as const,
    referenceServings: 6,
    translations: { fr: localized, en: { ...localized, title: "Mobile tart" } },
    categories: ["dessert"] as RecipeCategory[],
  };
}

function draft(value = recipe()) {
  return value;
}

async function uploadRecipeImage(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) =>
    ctx.storage.store(new Blob(["recipe-image"], { type: "image/jpeg" })),
  );
}

describe("recipe working drafts", () => {
  test("targeted seeding inserts only the requested recipe", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.recipes.seed, {
        adminPassword: password,
        slug: "mayonnaise",
      }),
    ).resolves.toEqual({ inserted: 1, updated: 0, total: 1 });
    await expect(
      t.query(api.recipes.getBySlug, { locale: "fr", slug: "mayonnaise" }),
    ).resolves.toMatchObject({ title: "Mayonnaise", author: "Louis" });
    await expect(
      t.query(api.recipes.getBySlug, { locale: "fr", slug: "amandin" }),
    ).resolves.toBeNull();
  });

  test("targeted seeding leaves other recipes unchanged", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.recipes.seed, {
      adminPassword: password,
      slug: "amandin",
    });
    await t.run(async (ctx) => {
      const amandin = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", "amandin"))
        .unique();
      if (!amandin) throw new Error("seed fixture missing");
      await ctx.db.patch(amandin._id, {
        translations: {
          ...amandin.translations,
          fr: { ...amandin.translations.fr, title: "Titre éditorial préservé" },
        },
      });
    });

    await t.mutation(api.recipes.seed, {
      adminPassword: password,
      slug: "mayonnaise",
    });

    await expect(
      t.query(api.recipes.getBySlug, { locale: "fr", slug: "amandin" }),
    ).resolves.toMatchObject({ title: "Titre éditorial préservé" });
  });

  test("targeted seeding clears stale reference servings from a yield-only recipe", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.recipes.seed, {
      adminPassword: password,
      slug: "banana-bread-du-kona-inn",
    });
    await t.run(async (ctx) => {
      const bananaBread = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", "banana-bread-du-kona-inn"))
        .unique();
      if (!bananaBread) throw new Error("seed fixture missing");
      await ctx.db.patch(bananaBread._id, { referenceServings: 6 });
    });

    await t.mutation(api.recipes.seed, {
      adminPassword: password,
      slug: "banana-bread-du-kona-inn",
    });

    const localized = await t.query(api.recipes.getBySlug, {
      locale: "fr",
      slug: "banana-bread-du-kona-inn",
    });
    expect(localized).toMatchObject({ referenceServings: 6 });
    const editing = await t.query(api.recipes.getForEditing, {
      locale: "fr",
      slug: "banana-bread-du-kona-inn",
      adminPassword: password,
    });
    expect(editing).toMatchObject({ hasUnpublishedChanges: true });
    expect(editing).not.toHaveProperty("referenceServings");
  });

  test("re-seeding preserves the public snapshot and visibility", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.recipes.seed, {
      adminPassword: password,
      slug: "mayonnaise",
    });
    const before = await t.query(api.recipes.getBySlug, {
      locale: "fr",
      slug: "mayonnaise",
    });
    await t.mutation(api.recipes.unpublish, {
      slug: "mayonnaise",
      adminPassword: password,
    });

    await t.mutation(api.recipes.seed, {
      adminPassword: password,
      slug: "mayonnaise",
    });

    await expect(
      t.query(api.recipes.getBySlug, { locale: "fr", slug: "mayonnaise" }),
    ).resolves.toBeNull();
    const stored = await t.run((ctx) =>
      ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", "mayonnaise"))
        .unique(),
    );
    expect(stored).toMatchObject({
      status: "draft",
      translations: { fr: { title: before?.title } },
    });
    const editing = await t.query(api.recipes.getForEditing, {
      locale: "fr",
      slug: "mayonnaise",
      adminPassword: password,
    });
    expect(editing).toMatchObject({
      status: "draft",
      hasUnpublishedChanges: true,
    });
  });

  test("seeding without a slug keeps the global behavior", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(api.recipes.seed, {
      adminPassword: password,
    });

    expect(result).toMatchObject({ inserted: result.total, updated: 0 });
    expect(result.total).toBeGreaterThan(1);
    await expect(
      t.query(api.recipes.getBySlug, { locale: "fr", slug: "amandin" }),
    ).resolves.not.toBeNull();
    await expect(
      t.query(api.recipes.getBySlug, { locale: "fr", slug: "mayonnaise" }),
    ).resolves.not.toBeNull();
  });

  test("paginates compact public recipe summaries", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.recipes.seed, { adminPassword: password });

    const first = await t.query(api.recipes.list, {
      locale: "fr",
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(first.page).toHaveLength(1);
    expect(first.isDone).toBe(false);
    expect(first.page[0]?.title).toEqual(expect.any(String));
    expect(first.page[0]?.ingredients[0]?.name).toEqual(expect.any(String));
    expect(first.page[0]).not.toHaveProperty("sections");

    const second = await t.query(api.recipes.list, {
      locale: "fr",
      paginationOpts: { numItems: 1, cursor: first.continueCursor },
    });
    expect(second.page).toHaveLength(1);
    expect(second.page[0]?._id).not.toBe(first.page[0]?._id);
  });

  test("targeted seeding rejects an unknown slug", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.recipes.seed, {
        adminPassword: password,
        slug: "recette-inconnue",
      }),
    ).rejects.toThrow("RECIPE_NOT_FOUND");
  });

  test("re-seeding preserves editorial reference portions", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.recipes.seed, { adminPassword: password });
    await t.run(async (ctx) => {
      const ambiguous = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", "amandin"))
        .unique();
      const inferred = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", "gateau-aux-pommes"))
        .unique();
      const yieldLabeled = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) =>
          q.eq("slug", "cookies-aux-pepites-de-chocolat-et-fleur-de-sel"),
        )
        .unique();
      if (!ambiguous || !inferred || !yieldLabeled) {
        throw new Error("seed fixture missing");
      }
      await ctx.db.patch(ambiguous._id, { referenceServings: 8 });
      await ctx.db.patch(inferred._id, { referenceServings: 7 });
      await ctx.db.patch(yieldLabeled._id, { referenceServings: 12 });
    });

    await t.mutation(api.recipes.seed, { adminPassword: password });

    await expect(
      t.query(api.recipes.getBySlug, { locale: "fr", slug: "amandin" }),
    ).resolves.toMatchObject({ referenceServings: 8 });
    await expect(
      t.query(api.recipes.getBySlug, {
        locale: "fr",
        slug: "gateau-aux-pommes",
      }),
    ).resolves.toMatchObject({ referenceServings: 7 });
    await expect(
      t.query(api.recipes.getBySlug, {
        locale: "fr",
        slug: "cookies-aux-pepites-de-chocolat-et-fleur-de-sel",
      }),
    ).resolves.toMatchObject({ referenceServings: 12 });
  });

  test("re-seeding preserves unknown legacy category labels", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.recipes.seed, { adminPassword: password });
    await t.run(async (ctx) => {
      const seeded = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", "amandin"))
        .unique();
      if (!seeded) throw new Error("seed fixture missing");
      await ctx.db.patch(seeded._id, {
        tags: [...(seeded.tags ?? []), "recette de famille"],
      });
    });

    await t.mutation(api.recipes.seed, { adminPassword: password });
    const editing = await t.query(api.recipes.getForEditing, {
      slug: "amandin",
      locale: "fr",
      adminPassword: password,
    });
    expect(editing?.legacyCategoryLabels).toContain("recette de famille");
  });

  test("category migration dry-runs, migrates recipes and drafts, and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const content = recipe("Migration des catégories");
    const storedTranslations = {
      fr: { ...content.translations.fr, servings: null },
      en: { ...content.translations.en, servings: null },
    };
    await t.run(async (ctx) => {
      const recipeId = await ctx.db.insert("recipes", {
        slug: "migration-categories",
        heroImageUrl: "",
        defaultLocale: content.defaultLocale,
        translations: storedTranslations,
        tags: ["plat", "héritage"],
        status: "draft",
      });
      await ctx.db.insert("recipeDrafts", {
        recipeId,
        heroImageUrl: "",
        defaultLocale: content.defaultLocale,
        translations: storedTranslations,
        tags: ["sale", "cahier bleu"],
        revision: 0,
        publishedRevision: -1,
        updatedAt: Date.now(),
      });
    });

    const migrationArgs = {
      cursor: null,
      oneBatchOnly: true,
      batchSize: 100,
    } as const;
    const readMigratedCategoryFields = () =>
      t.run(async (ctx) => {
        const migratedRecipe = await ctx.db
          .query("recipes")
          .withIndex("by_slug", (q) => q.eq("slug", "migration-categories"))
          .unique();
        if (!migratedRecipe) throw new Error("migration recipe missing");
        const migratedDraft = await ctx.db
          .query("recipeDrafts")
          .withIndex("by_recipeId", (q) => q.eq("recipeId", migratedRecipe._id))
          .unique();
        if (!migratedDraft) throw new Error("migration draft missing");
        return {
          recipe: {
            categories: migratedRecipe.categories,
            legacyCategoryLabels: migratedRecipe.legacyCategoryLabels,
          },
          draft: {
            categories: migratedDraft.categories,
            legacyCategoryLabels: migratedDraft.legacyCategoryLabels,
          },
        };
      });
    await expect(
      t.mutation(internal.migrations.backfillRecipeCategories, {
        ...migrationArgs,
        dryRun: true,
      }),
    ).rejects.toThrow();

    await t.mutation(internal.migrations.backfillRecipeCategories, {
      ...migrationArgs,
      dryRun: false,
    });
    await t.mutation(internal.migrations.backfillDraftCategories, {
      ...migrationArgs,
      dryRun: false,
    });
    const first = await readMigratedCategoryFields();
    expect(first).toEqual({
      recipe: { categories: ["plat"], legacyCategoryLabels: ["héritage"] },
      draft: { categories: ["sale"], legacyCategoryLabels: ["cahier bleu"] },
    });

    await t.mutation(internal.migrations.backfillRecipeCategories, {
      ...migrationArgs,
      dryRun: false,
    });
    await t.mutation(internal.migrations.backfillDraftCategories, {
      ...migrationArgs,
      dryRun: false,
    });
    await expect(readMigratedCategoryFields()).resolves.toEqual(first);
  });

  test("falls back to the public snapshot for legacy recipes without a draft", async () => {
    const t = convexTest(schema, modules);
    const content = recipe("Recette historique");
    const { yieldLabel: _frYieldLabel, ...legacyFrench } =
      content.translations.fr;
    const { yieldLabel: _enYieldLabel, ...legacyEnglish } =
      content.translations.en;
    const legacyTranslations = {
      fr: { ...legacyFrench, servings: { quantity: 20, unit: "environ" } },
      en: { ...legacyEnglish, servings: { quantity: 20, unit: "about" } },
    };
    await t.run(async (ctx) => {
      await ctx.db.insert("recipes", {
        slug: "gougeres",
        heroImageUrl: "",
        defaultLocale: content.defaultLocale,
        translations: legacyTranslations,
        categories: content.categories,
        status: "published",
      });
    });
    const editing = await t.query(api.recipes.getForEditing, {
      slug: "gougeres",
      locale: "fr",
      adminPassword: password,
    });
    expect(editing).toMatchObject({
      title: "Recette historique",
      revision: 0,
      publishedRevision: 0,
      hasUnpublishedChanges: false,
    });
    expect(editing?.translations.fr.yieldLabel).toBe("Environ 20 gougères");
    const publicRecipe = await t.query(api.recipes.getBySlug, {
      locale: "en",
      slug: "gougeres",
    });
    expect(publicRecipe?.yieldLabel).toBe("About 20 gougères");
  });

  test("dual-reads legacy tags and dual-writes canonical categories without losing unknown labels", async () => {
    const t = convexTest(schema, modules);
    const content = recipe("Recette avec catégories historiques");
    await t.run(async (ctx) => {
      await ctx.db.insert("recipes", {
        slug: "categories-historiques",
        heroImageUrl: "",
        defaultLocale: content.defaultLocale,
        referenceServings: content.referenceServings,
        translations: {
          fr: { ...content.translations.fr, servings: null },
          en: { ...content.translations.en, servings: null },
        },
        tags: ["dessert", "famille"],
        status: "published",
      });
    });

    const editing = await t.query(api.recipes.getForEditing, {
      slug: "categories-historiques",
      locale: "fr",
      adminPassword: password,
    });
    expect(editing).toMatchObject({
      categories: ["dessert"],
      legacyCategoryLabels: ["famille"],
    });

    const saved = await t.mutation(api.recipes.saveDraft, {
      slug: "categories-historiques",
      expectedRevision: 0,
      adminPassword: password,
      recipe: {
        defaultLocale: content.defaultLocale,
        referenceServings: content.referenceServings,
        translations: content.translations,
        tags: ["dessert", "famille"],
      },
    });

    await t.run(async (ctx) => {
      const draft = await ctx.db.query("recipeDrafts").unique();
      expect(draft).toMatchObject({
        categories: ["dessert"],
        legacyCategoryLabels: ["famille"],
        tags: ["dessert", "famille"],
      });
    });

    await t.mutation(api.recipes.publishDraft, {
      slug: "categories-historiques",
      expectedRevision: saved.revision,
      adminPassword: password,
    });
    await expect(
      t.query(api.recipes.getBySlug, {
        locale: "fr",
        slug: "categories-historiques",
      }),
    ).resolves.toMatchObject({ categories: ["dessert"] });
  });

  test("creates a private draft with an initial revision", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe(),
      adminPassword: password,
    });

    expect(created.revision).toBe(0);
    expect(created.publishedRevision).toBe(-1);
    expect(
      await t.query(api.recipes.getBySlug, {
        locale: "fr",
        slug: created.slug,
      }),
    ).toBeNull();

    const editing = await t.query(api.recipes.listForEditing, {
      locale: "fr",
      adminPassword: password,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(editing.page[0]).toMatchObject({
      slug: created.slug,
      hasUnpublishedChanges: true,
      revision: 0,
    });
  });

  test("allows an incomplete draft but requires a yield or reference servings to publish", async () => {
    const t = convexTest(schema, modules);
    const incomplete = { ...recipe(), referenceServings: undefined };
    incomplete.translations.fr.yieldLabel = "";
    incomplete.translations.en.yieldLabel = "";
    const created = await t.mutation(api.recipes.create, {
      recipe: incomplete,
      adminPassword: password,
    });

    await expect(
      t.mutation(api.recipes.publishDraft, {
        slug: created.slug,
        expectedRevision: 0,
        adminPassword: password,
      }),
    ).rejects.toThrow("RECIPE_NOT_READY");
  });

  test("rejects reference servings outside the public selector bounds", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.recipes.create, {
        recipe: { ...recipe(), referenceServings: 51 },
        adminPassword: password,
      }),
    ).rejects.toThrow("RECIPE_LIMIT_EXCEEDED");
  });

  test("detects stale autosaves", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe(),
      adminPassword: password,
    });
    const next = recipe("Titre modifié");

    await t.mutation(api.recipes.saveDraft, {
      slug: created.slug,
      recipe: {
        defaultLocale: next.defaultLocale,
        referenceServings: next.referenceServings,
        translations: next.translations,
        categories: next.categories,
      },
      expectedRevision: 0,
      adminPassword: password,
    });

    await expect(
      t.mutation(api.recipes.saveDraft, {
        slug: created.slug,
        recipe: {
          defaultLocale: next.defaultLocale,
          referenceServings: next.referenceServings,
          translations: next.translations,
          categories: next.categories,
        },
        expectedRevision: 0,
        adminPassword: password,
      }),
    ).rejects.toThrow(/RECIPE_DRAFT_CONFLICT/);
  });

  test("allows an explicit device replacement to advance the latest revision", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe(),
      adminPassword: password,
    });
    const first = recipe("Premier appareil");
    await t.mutation(api.recipes.saveDraft, {
      slug: created.slug,
      recipe: {
        defaultLocale: first.defaultLocale,
        referenceServings: first.referenceServings,
        translations: first.translations,
        categories: first.categories,
      },
      expectedRevision: 0,
      adminPassword: password,
    });
    const replacement = recipe("Téléphone prioritaire");
    const saved = await t.mutation(api.recipes.saveDraft, {
      slug: created.slug,
      recipe: {
        defaultLocale: replacement.defaultLocale,
        referenceServings: replacement.referenceServings,
        translations: replacement.translations,
        categories: replacement.categories,
      },
      expectedRevision: 0,
      force: true,
      adminPassword: password,
    });
    expect(saved.revision).toBe(2);
    const editing = await t.query(api.recipes.getForEditing, {
      locale: "fr",
      slug: created.slug,
      adminPassword: password,
    });
    expect(editing?.title).toBe("Téléphone prioritaire");
  });

  test("keeps published content stable until the new draft is published", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe("Version publiée"),
      adminPassword: password,
    });
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: 0,
      adminPassword: password,
    });

    const changed = recipe("Brouillon de travail");
    const saved = await t.mutation(api.recipes.saveDraft, {
      slug: created.slug,
      recipe: {
        defaultLocale: changed.defaultLocale,
        referenceServings: changed.referenceServings,
        translations: changed.translations,
        categories: changed.categories,
      },
      expectedRevision: 0,
      adminPassword: password,
    });

    const beforePublish = await t.query(api.recipes.getBySlug, {
      locale: "fr",
      slug: created.slug,
    });
    expect(beforePublish?.title).toBe("Version publiée");

    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: saved.revision,
      adminPassword: password,
    });
    const afterPublish = await t.query(api.recipes.getBySlug, {
      locale: "fr",
      slug: created.slug,
    });
    expect(afterPublish?.title).toBe("Brouillon de travail");
  });

  test("rejects publication until required French content is ready", async () => {
    const t = convexTest(schema, modules);
    const incomplete = recipe("");
    const created = await t.mutation(api.recipes.create, {
      recipe: incomplete,
      adminPassword: password,
    });

    await expect(
      t.mutation(api.recipes.publishDraft, {
        slug: created.slug,
        expectedRevision: 0,
        adminPassword: password,
      }),
    ).rejects.toThrow(/RECIPE_NOT_READY/);
  });

  test("publishes a complete piece-based recipe without reference servings", async () => {
    const t = convexTest(schema, modules);
    const pieceBasedRecipe = recipe("Cookies aux pépites de chocolat");
    delete (pieceBasedRecipe as Partial<typeof pieceBasedRecipe>)
      .referenceServings;
    pieceBasedRecipe.translations.fr.yieldLabel = "Environ 20 gros cookies";
    pieceBasedRecipe.translations.en.yieldLabel = "About 20 large cookies";

    const created = await t.mutation(api.recipes.create, {
      recipe: pieceBasedRecipe,
      adminPassword: password,
    });
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: 0,
      adminPassword: password,
    });

    const published = await t.query(api.recipes.getBySlug, {
      locale: "fr",
      slug: created.slug,
    });
    expect(published).toMatchObject({
      yieldLabel: "Environ 20 gros cookies",
      status: "published",
    });
    expect(published).not.toHaveProperty("referenceServings");
  });

  test("protects admin reads with the configured password", async () => {
    const t = convexTest(schema, modules);
    const reads = [
      t.query(api.recipes.listForEditing, {
        locale: "fr",
        adminPassword: "wrong-password",
        paginationOpts: { numItems: 20, cursor: null },
      }),
      t.query(api.recipes.getForEditing, {
        slug: "missing",
        locale: "fr",
        adminPassword: "wrong-password",
      }),
    ];
    const results = await Promise.allSettled(reads);
    expect(
      results.every(
        (result) =>
          result.status === "rejected" &&
          String(result.reason).includes("RECIPE_ADMIN_REQUIRED"),
      ),
    ).toBe(true);
  });

  test("protects every draft mutation with the configured password", async () => {
    const t = convexTest(schema, modules);
    const attempts = [
      () =>
        t.mutation(api.recipes.create, {
          recipe: recipe(),
          adminPassword: "wrong-password",
        }),
      () =>
        t.mutation(api.recipes.saveDraft, {
          slug: "missing",
          recipe: draft(),
          expectedRevision: 0,
          adminPassword: "wrong-password",
        }),
      () =>
        t.mutation(api.recipes.publishDraft, {
          slug: "missing",
          expectedRevision: 0,
          adminPassword: "wrong-password",
        }),
      () =>
        t.mutation(api.recipes.discardDraft, {
          slug: "missing",
          expectedRevision: 0,
          adminPassword: "wrong-password",
        }),
      () =>
        t.mutation(api.recipes.unpublish, {
          slug: "missing",
          adminPassword: "wrong-password",
        }),
      () =>
        t.mutation(api.recipes.generateUploadUrl, {
          adminPassword: "wrong-password",
        }),
      () => t.mutation(api.recipes.seed, { adminPassword: "wrong-password" }),
      () =>
        t.mutation(api.recipes.setUnsplashHeroImage, {
          slug: "missing",
          imageUrl: "https://example.com/image.jpg",
          alt: "",
          photographerName: "Maman",
          photographerUrl: "https://example.com",
          photoUrl: "https://example.com/photo",
          expectedRevision: 0,
          adminPassword: "wrong-password",
        }),
    ];
    const results = await Promise.allSettled(
      attempts.map((attempt) => attempt()),
    );
    expect(
      results.every(
        (result) =>
          result.status === "rejected" &&
          String(result.reason).includes("RECIPE_ADMIN_REQUIRED"),
      ),
    ).toBe(true);
  });

  test("keeps internet image changes private until publication", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe("Image privée"),
      adminPassword: password,
    });
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: 0,
      adminPassword: password,
    });
    const image = await t.mutation(api.recipes.setUnsplashHeroImage, {
      slug: created.slug,
      imageUrl: "https://images.example/private.jpg",
      alt: "Tarte",
      photographerName: "Maman",
      photographerUrl: "https://example.com/maman",
      photoUrl: "https://example.com/photo",
      expectedRevision: 0,
      adminPassword: password,
    });
    const publicBefore = await t.query(api.recipes.getBySlug, {
      locale: "fr",
      slug: created.slug,
    });
    expect(publicBefore?.heroImageUrl).toBe("");
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: image.revision,
      adminPassword: password,
    });
    const publicAfter = await t.query(api.recipes.getBySlug, {
      locale: "fr",
      slug: created.slug,
    });
    expect(publicAfter?.heroImageUrl).toBe(
      "https://images.example/private.jpg",
    );
  });

  test("cleans replaced and discarded images without deleting the published image", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe("Images révisionnées"),
      adminPassword: password,
    });
    const temporaryStorageId = await uploadRecipeImage(t);
    const temporaryImage = await t.mutation(api.recipes.setHeroImage, {
      slug: created.slug,
      storageId: temporaryStorageId,
      expectedRevision: 0,
      adminPassword: password,
    });
    const firstStorageId = await uploadRecipeImage(t);
    const firstImage = await t.mutation(api.recipes.setHeroImage, {
      slug: created.slug,
      storageId: firstStorageId,
      expectedRevision: temporaryImage.revision,
      adminPassword: password,
    });
    expect(
      await t.run(async (ctx) =>
        ctx.db.system.get("_storage", temporaryStorageId),
      ),
    ).toBeNull();
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: firstImage.revision,
      adminPassword: password,
    });

    const secondStorageId = await uploadRecipeImage(t);
    const secondImage = await t.mutation(api.recipes.setHeroImage, {
      slug: created.slug,
      storageId: secondStorageId,
      expectedRevision: firstImage.revision,
      adminPassword: password,
    });
    expect(
      await t.run(async (ctx) => ctx.db.system.get("_storage", firstStorageId)),
    ).not.toBeNull();

    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: secondImage.revision,
      adminPassword: password,
    });
    expect(
      await t.run(async (ctx) => ctx.db.system.get("_storage", firstStorageId)),
    ).toBeNull();

    const thirdStorageId = await uploadRecipeImage(t);
    const thirdImage = await t.mutation(api.recipes.setHeroImage, {
      slug: created.slug,
      storageId: thirdStorageId,
      expectedRevision: secondImage.revision,
      adminPassword: password,
    });
    await t.mutation(api.recipes.discardDraft, {
      slug: created.slug,
      expectedRevision: thirdImage.revision,
      adminPassword: password,
    });
    expect(
      await t.run(async (ctx) => ctx.db.system.get("_storage", thirdStorageId)),
    ).toBeNull();
    expect(
      await t.run(async (ctx) =>
        ctx.db.system.get("_storage", secondStorageId),
      ),
    ).not.toBeNull();
  });

  test("cleanup works after recipe deletion and preserves cross-recipe references", async () => {
    const t = convexTest(schema, modules);
    const orphanStorageId = await uploadRecipeImage(t);
    await expect(
      t.mutation(api.recipes.cleanupHeroImageUpload, {
        slug: "already-deleted",
        storageId: orphanStorageId,
        adminPassword: password,
      }),
    ).resolves.toMatchObject({ referenced: false, slug: "already-deleted" });
    expect(
      await t.run(async (ctx) =>
        ctx.db.system.get("_storage", orphanStorageId),
      ),
    ).toBeNull();

    const sharedStorageId = await uploadRecipeImage(t);
    const first = await t.mutation(api.recipes.create, {
      recipe: recipe("Partage un"),
      adminPassword: password,
    });
    const second = await t.mutation(api.recipes.create, {
      recipe: recipe("Partage deux"),
      adminPassword: password,
    });
    await t.run(async (ctx) => {
      const recipes = await Promise.all(
        [first.slug, second.slug].map((slug) =>
          ctx.db
            .query("recipes")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique(),
        ),
      );
      for (const storedRecipe of recipes) {
        if (!storedRecipe) throw new Error("recipe fixture missing");
        await ctx.db.patch(storedRecipe._id, {
          heroImageStorageId: sharedStorageId,
        });
      }
    });
    await t.mutation(api.recipes.deleteRecipe, {
      slug: first.slug,
      expectedRevision: 0,
      adminPassword: password,
    });
    expect(
      await t.run(async (ctx) =>
        ctx.db.system.get("_storage", sharedStorageId),
      ),
    ).not.toBeNull();
    await expect(
      t.mutation(api.recipes.cleanupHeroImageUpload, {
        slug: first.slug,
        storageId: sharedStorageId,
        adminPassword: password,
      }),
    ).resolves.toMatchObject({ referenced: true, slug: second.slug });
  });

  test("discards unpublished edits back to the public snapshot", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe("Version stable"),
      adminPassword: password,
    });
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: 0,
      adminPassword: password,
    });
    const changed = recipe("À abandonner");
    const saved = await t.mutation(api.recipes.saveDraft, {
      slug: created.slug,
      recipe: {
        defaultLocale: changed.defaultLocale,
        referenceServings: changed.referenceServings,
        translations: changed.translations,
        categories: changed.categories,
      },
      expectedRevision: 0,
      adminPassword: password,
    });

    const discarded = await t.mutation(api.recipes.discardDraft, {
      slug: created.slug,
      expectedRevision: saved.revision,
      adminPassword: password,
    });
    expect(discarded).toMatchObject({
      publishedRevision: discarded.revision,
      draft: { translations: { fr: { title: "Version stable" } } },
    });
    const editing = await t.query(api.recipes.getForEditing, {
      locale: "fr",
      slug: created.slug,
      adminPassword: password,
    });
    expect(editing).toMatchObject({
      title: "Version stable",
      hasUnpublishedChanges: false,
    });
  });

  test("returns compact publication and readiness state in admin summaries", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe(),
      adminPassword: password,
    });

    const summaries = await t.query(api.recipes.listForEditing, {
      locale: "fr",
      adminPassword: password,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(summaries.page[0]).toMatchObject({
      slug: created.slug,
      hasPublishedVersion: false,
      hasUnpublishedChanges: true,
      canDiscard: false,
      readiness: {
        sections: {
          info: true,
          details: true,
          ingredients: true,
          preparation: true,
        },
        translation: { fr: true, en: true },
      },
    });
  });

  test("rejects editorial fields and drafts beyond the bounded contract", async () => {
    const t = convexTest(schema, modules);
    const oversizedTitle = recipe("x".repeat(201));

    await expect(
      t.mutation(api.recipes.create, {
        recipe: oversizedTitle,
        adminPassword: password,
      }),
    ).rejects.toThrow(/RECIPE_LIMIT_EXCEEDED/);

    const huge = recipe("Within the field limit");
    huge.translations.fr.sections = Array.from(
      { length: 50 },
      (_, sectionIndex) => ({
        title: `Section ${sectionIndex}`,
        steps: Array.from({ length: 6 }, () => "é".repeat(2_000)),
      }),
    );

    await expect(
      t.mutation(api.recipes.create, {
        recipe: huge,
        adminPassword: password,
      }),
    ).rejects.toThrow(/RECIPE_DRAFT_TOO_LARGE/);
  });

  test("rejects a create whose normalized payload fits but dual-written stored document exceeds 500 kB", async () => {
    const t = convexTest(schema, modules);
    const content = recipe("Dual write");
    const longLocalized = {
      ...content.translations.fr,
      notes: Array.from({ length: 100 }, () => "n".repeat(2_000)),
      sections: [
        {
          title: "Préparation",
          steps: Array.from({ length: 23 }, () => "x".repeat(2_000)),
        },
      ],
    };
    const legacyCategoryLabels = Array.from(
      { length: 50 },
      (_, index) => `${String(index).padStart(2, "0")}${"l".repeat(98)}`,
    );
    const boundedPayload = {
      ...draft(content),
      translations: { fr: longLocalized, en: longLocalized },
      legacyCategoryLabels,
    };
    expect(
      new TextEncoder().encode(JSON.stringify(boundedPayload)).byteLength,
    ).toBeLessThan(500_000);
    await expect(
      t.mutation(api.recipes.create, {
        recipe: boundedPayload,
        adminPassword: password,
      }),
    ).rejects.toThrow("RECIPE_DRAFT_TOO_LARGE");
  });

  test("unpublishes without losing the synchronized working draft", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe("À retirer"),
      adminPassword: password,
    });
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: 0,
      adminPassword: password,
    });
    await t.mutation(api.recipes.unpublish, {
      slug: created.slug,
      adminPassword: password,
    });

    expect(
      await t.query(api.recipes.getBySlug, {
        locale: "fr",
        slug: created.slug,
      }),
    ).toBeNull();
    const editing = await t.query(api.recipes.getForEditing, {
      locale: "fr",
      slug: created.slug,
      adminPassword: password,
    });
    expect(editing?.title).toBe("À retirer");
  });

  test("retains an approved baseline when unpublishing a legacy recipe", async () => {
    const t = convexTest(schema, modules);
    const content = recipe("Archive approuvée");
    const { yieldLabel: _frYieldLabel, ...legacyFrench } =
      content.translations.fr;
    const { yieldLabel: _enYieldLabel, ...legacyEnglish } =
      content.translations.en;
    await t.run(async (ctx) => {
      await ctx.db.insert("recipes", {
        slug: "archive-approuvee",
        heroImageUrl: "",
        defaultLocale: content.defaultLocale,
        referenceServings: content.referenceServings,
        translations: {
          fr: { ...legacyFrench, servings: { quantity: 6, unit: "personnes" } },
          en: { ...legacyEnglish, servings: { quantity: 6, unit: "people" } },
        },
        categories: content.categories,
        status: "published",
      });
    });
    await t.mutation(api.recipes.unpublish, {
      slug: "archive-approuvee",
      adminPassword: password,
    });
    const editing = await t.query(api.recipes.getForEditing, {
      slug: "archive-approuvee",
      locale: "fr",
      adminPassword: password,
    });
    expect(editing).toMatchObject({
      hasPublishedVersion: true,
      publishedRevision: 0,
      hasUnpublishedChanges: false,
      isPublic: false,
    });
  });

  test("refuses to discard a recipe that has never been published", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe("Nouveau"),
      adminPassword: password,
    });
    await expect(
      t.mutation(api.recipes.discardDraft, {
        slug: created.slug,
        expectedRevision: 0,
        adminPassword: password,
      }),
    ).rejects.toThrow(/RECIPE_HAS_NO_PUBLISHED_VERSION/);
  });

  test("deletes a recipe at the expected revision and cleans related records", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const created = await t.mutation(api.recipes.create, {
        recipe: recipe("À supprimer"),
        adminPassword: password,
      });
      await t.run(async (ctx) => {
        const commentId = await ctx.db.insert("recipeComments", {
          recipeId: created.recipeId,
          ownerDigest: "owner",
          text: "Commentaire lié",
        });
        await ctx.db.insert("commentReactionSummaries", {
          commentId,
          thumbsUpCount: 1,
          thumbsDownCount: 0,
        });
        await ctx.db.insert("commentReactions", {
          commentId,
          participantDigest: "visitor",
          direction: "up",
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(api.recipes.deleteRecipe, {
          slug: created.slug,
          expectedRevision: 4,
          adminPassword: password,
        }),
      ).rejects.toThrow(/RECIPE_DRAFT_CONFLICT:0/);

      await t.mutation(api.recipes.deleteRecipe, {
        slug: created.slug,
        expectedRevision: 0,
        adminPassword: password,
      });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      await t.run(async (ctx) => {
        expect(await ctx.db.get(created.recipeId)).toBeNull();
        expect(await ctx.db.query("recipeDrafts").collect()).toHaveLength(0);
        expect(await ctx.db.query("recipeComments").collect()).toHaveLength(0);
        expect(
          await ctx.db.query("commentReactionSummaries").collect(),
        ).toHaveLength(0);
        expect(await ctx.db.query("commentReactions").collect()).toHaveLength(
          0,
        );
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
