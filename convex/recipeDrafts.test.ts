/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

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
    tags: ["dessert"],
    status: "draft" as const,
  };
}

function draft(value = recipe()) {
  const { status: _status, ...content } = value;
  return content;
}

describe("recipe working drafts", () => {
  test("falls back to the public snapshot for legacy recipes without a draft", async () => {
    const t = convexTest(schema, modules);
    const content = recipe("Recette historique");
    const { yieldLabel: _frYieldLabel, ...legacyFrench } = content.translations.fr;
    const { yieldLabel: _enYieldLabel, ...legacyEnglish } = content.translations.en;
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
        tags: content.tags,
        status: "published",
      });
    });
    const editing = await t.query(api.recipes.getForEditing, {
      slug: "gougeres",
      locale: "fr",
      adminPassword: password,
    });
    expect(editing).toMatchObject({ title: "Recette historique", revision: 0, publishedRevision: 0, hasUnpublishedChanges: false });
    expect(editing?.translations.fr.yieldLabel).toBe("Environ 20 gougères");
    const publicRecipe = await t.query(api.recipes.getBySlug, {
      locale: "en",
      slug: "gougeres",
    });
    expect(publicRecipe?.yieldLabel).toBe("About 20 gougères");
  });

  test("creates a private draft with an initial revision", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe(),
      adminPassword: password,
    });

    expect(created.revision).toBe(0);
    expect(created.publishedRevision).toBe(-1);
    expect(await t.query(api.recipes.getBySlug, { locale: "fr", slug: created.slug })).toBeNull();

    const editing = await t.query(api.recipes.listForEditing, {
      locale: "fr",
      adminPassword: password,
    });
    expect(editing[0]).toMatchObject({
      slug: created.slug,
      hasUnpublishedChanges: true,
      revision: 0,
    });
  });

  test("allows an incomplete draft but requires reference servings to publish", async () => {
    const t = convexTest(schema, modules);
    const incomplete = { ...recipe(), referenceServings: undefined };
    const created = await t.mutation(api.recipes.create, {
      recipe: incomplete,
      adminPassword: password,
    });

    await expect(t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: 0,
      adminPassword: password,
    })).rejects.toThrow("RECIPE_NOT_READY");
  });

  test("rejects reference servings outside the public selector bounds", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.recipes.create, {
      recipe: { ...recipe(), referenceServings: 51 },
      adminPassword: password,
    })).rejects.toThrow("RECIPE_LIMIT_EXCEEDED");
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
        tags: next.tags,
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
          tags: next.tags,
        },
        expectedRevision: 0,
        adminPassword: password,
      }),
    ).rejects.toThrow(/RECIPE_DRAFT_CONFLICT/);
  });

  test("allows an explicit device replacement to advance the latest revision", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, { recipe: recipe(), adminPassword: password });
    const first = recipe("Premier appareil");
    await t.mutation(api.recipes.saveDraft, {
      slug: created.slug,
      recipe: { defaultLocale: first.defaultLocale, referenceServings: first.referenceServings, translations: first.translations, tags: first.tags },
      expectedRevision: 0,
      adminPassword: password,
    });
    const replacement = recipe("Téléphone prioritaire");
    const saved = await t.mutation(api.recipes.saveDraft, {
      slug: created.slug,
      recipe: { defaultLocale: replacement.defaultLocale, referenceServings: replacement.referenceServings, translations: replacement.translations, tags: replacement.tags },
      expectedRevision: 0,
      force: true,
      adminPassword: password,
    });
    expect(saved.revision).toBe(2);
    const editing = await t.query(api.recipes.getForEditing, { locale: "fr", slug: created.slug, adminPassword: password });
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
        tags: changed.tags,
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

  test("protects admin reads with the configured password", async () => {
    const t = convexTest(schema, modules);
    const reads = [
      t.query(api.recipes.listForEditing, { locale: "fr", adminPassword: "wrong-password" }),
      t.query(api.recipes.getForEditing, { slug: "missing", locale: "fr", adminPassword: "wrong-password" }),
    ];
    const results = await Promise.allSettled(reads);
    expect(results.every((result) => result.status === "rejected" && String(result.reason).includes("RECIPE_ADMIN_REQUIRED"))).toBe(true);
  });

  test("protects every draft mutation with the configured password", async () => {
    const t = convexTest(schema, modules);
    const attempts = [
      () => t.mutation(api.recipes.create, { recipe: recipe(), adminPassword: "wrong-password" }),
      () => t.mutation(api.recipes.saveDraft, { slug: "missing", recipe: draft(), expectedRevision: 0, adminPassword: "wrong-password" }),
      () => t.mutation(api.recipes.publishDraft, { slug: "missing", expectedRevision: 0, adminPassword: "wrong-password" }),
      () => t.mutation(api.recipes.discardDraft, { slug: "missing", expectedRevision: 0, adminPassword: "wrong-password" }),
      () => t.mutation(api.recipes.unpublish, { slug: "missing", adminPassword: "wrong-password" }),
      () => t.mutation(api.recipes.generateUploadUrl, { adminPassword: "wrong-password" }),
      () => t.mutation(api.recipes.seed, { adminPassword: "wrong-password" }),
      () => t.mutation(api.recipes.setUnsplashHeroImage, { slug: "missing", imageUrl: "https://example.com/image.jpg", alt: "", photographerName: "Maman", photographerUrl: "https://example.com", photoUrl: "https://example.com/photo", expectedRevision: 0, adminPassword: "wrong-password" }),
    ];
    const results = await Promise.allSettled(attempts.map((attempt) => attempt()));
    expect(results.every((result) => result.status === "rejected" && String(result.reason).includes("RECIPE_ADMIN_REQUIRED"))).toBe(true);
  });

  test("keeps internet image changes private until publication", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, { recipe: recipe("Image privée"), adminPassword: password });
    await t.mutation(api.recipes.publishDraft, { slug: created.slug, expectedRevision: 0, adminPassword: password });
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
    const publicBefore = await t.query(api.recipes.getBySlug, { locale: "fr", slug: created.slug });
    expect(publicBefore?.heroImageUrl).toBe("");
    await t.mutation(api.recipes.publishDraft, { slug: created.slug, expectedRevision: image.revision, adminPassword: password });
    const publicAfter = await t.query(api.recipes.getBySlug, { locale: "fr", slug: created.slug });
    expect(publicAfter?.heroImageUrl).toBe("https://images.example/private.jpg");
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
        tags: changed.tags,
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
    });

    expect(summaries[0]).toMatchObject({
      slug: created.slug,
      hasPublishedVersion: false,
      hasUnpublishedChanges: true,
      canDiscard: false,
      readiness: {
        sections: { essentials: true, details: true, ingredients: true, preparation: true },
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
    huge.translations.fr.sections = Array.from({ length: 50 }, (_, sectionIndex) => ({
      title: `Section ${sectionIndex}`,
      steps: Array.from({ length: 6 }, () => "é".repeat(2_000)),
    }));

    await expect(
      t.mutation(api.recipes.create, {
        recipe: huge,
        adminPassword: password,
      }),
    ).rejects.toThrow(/RECIPE_DRAFT_TOO_LARGE/);
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

    expect(await t.query(api.recipes.getBySlug, { locale: "fr", slug: created.slug })).toBeNull();
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
    const { yieldLabel: _frYieldLabel, ...legacyFrench } = content.translations.fr;
    const { yieldLabel: _enYieldLabel, ...legacyEnglish } = content.translations.en;
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
        tags: content.tags,
        status: "published",
      });
    });
    await t.mutation(api.recipes.unpublish, { slug: "archive-approuvee", adminPassword: password });
    const editing = await t.query(api.recipes.getForEditing, { slug: "archive-approuvee", locale: "fr", adminPassword: password });
    expect(editing).toMatchObject({ hasPublishedVersion: true, publishedRevision: 0, hasUnpublishedChanges: false, isPublic: false });
  });

  test("refuses to discard a recipe that has never been published", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipes.create, { recipe: recipe("Nouveau"), adminPassword: password });
    await expect(t.mutation(api.recipes.discardDraft, { slug: created.slug, expectedRevision: 0, adminPassword: password })).rejects.toThrow(/RECIPE_HAS_NO_PUBLISHED_VERSION/);
  });
});
