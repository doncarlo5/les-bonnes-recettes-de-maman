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
    servings: { quantity: 6, unit: "personnes" },
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
    translations: { fr: localized, en: { ...localized, title: "Mobile tart" } },
    tags: ["dessert"],
    status: "draft" as const,
  };
}

describe("recipe working drafts", () => {
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
          translations: next.translations,
          tags: next.tags,
        },
        expectedRevision: 0,
        adminPassword: password,
      }),
    ).rejects.toThrow(/RECIPE_DRAFT_CONFLICT/);
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
    await expect(
      t.query(api.recipes.listForEditing, {
        locale: "fr",
        adminPassword: "wrong-password",
      }),
    ).rejects.toThrow(/RECIPE_ADMIN_REQUIRED/);
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
        translations: changed.translations,
        tags: changed.tags,
      },
      expectedRevision: 0,
      adminPassword: password,
    });

    await t.mutation(api.recipes.discardDraft, {
      slug: created.slug,
      expectedRevision: saved.revision,
      adminPassword: password,
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
});
