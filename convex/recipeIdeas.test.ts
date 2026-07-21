/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { RecipeCategory } from "../lib/recipe-categories";

const modules = import.meta.glob("./**/*.ts");
const password = "test-password";
const participantKey = "a".repeat(48);
const otherParticipantKey = "b".repeat(48);

function recipe(title = "Tarte issue d'une idée") {
  const localized = {
    title,
    author: "Maman",
    description: "Une recette complète issue du carnet d'idées.",
    yieldLabel: "6 personnes",
    prepTime: "20 min",
    cookTime: "30 min",
    totalTime: "50 min",
    timeLabel: "50 min",
    temperature: "180 °C",
    ingredients: [
      {
        id: "ingredient-flour",
        name: "Farine",
        quantity: "200",
        unit: "g",
        notes: "",
      },
    ],
    sections: [
      {
        title: "Préparation",
        steps: [
          {
            id: "step-mix",
            text: "Mélanger puis cuire.",
            ingredientUses: [] as Array<{
              ingredientId: string;
              amount?: { quantity: string; unit: string };
            }>,
          },
        ],
      },
    ],
    subRecipes: [],
    notes: [],
  };
  return {
    defaultLocale: "fr" as const,
    referenceServings: 6,
    translations: { fr: localized, en: { ...localized, title: "Idea tart" } },
    categories: ["dessert"] as RecipeCategory[],
  };
}

async function listIdeas(
  t: ReturnType<typeof convexTest>,
  state: "outstanding" | "completed",
  key = participantKey,
) {
  return t.query(api.recipeIdeas.list, {
    state,
    locale: "fr",
    participantKey: key,
    paginationOpts: { numItems: 10, cursor: null },
  });
}

describe("recipe ideas", () => {
  test("publishes, normalizes, edits, and removes an owned idea", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(api.recipeIdeas.create, {
      participantKey,
      authorName: "  Jeanne  ",
      text: "  Une tarte avec les mirabelles du jardin  ",
      honeypot: "",
    });

    let page = await listIdeas(t, "outstanding");
    expect(page.page[0]).toMatchObject({
      _id: created.ideaId,
      authorName: "Jeanne",
      text: "Une tarte avec les mirabelles du jardin",
      canEdit: true,
      canDelete: true,
    });
    expect((await listIdeas(t, "outstanding", otherParticipantKey)).page[0])
      .toMatchObject({ canEdit: false, canDelete: false });

    await t.mutation(api.recipeIdeas.updateOwn, {
      ideaId: created.ideaId,
      participantKey,
      authorName: "Jeanne",
      text: "Une tarte fine aux mirabelles",
    });
    page = await listIdeas(t, "outstanding");
    expect(page.page[0].text).toBe("Une tarte fine aux mirabelles");

    await expect(
      t.mutation(api.recipeIdeas.removeOwn, {
        ideaId: created.ideaId,
        participantKey: otherParticipantKey,
      }),
    ).rejects.toThrow("RECIPE_IDEA_OWNER_REQUIRED");
    await t.mutation(api.recipeIdeas.removeOwn, {
      ideaId: created.ideaId,
      participantKey,
    });
    expect((await listIdeas(t, "outstanding")).page).toHaveLength(0);
    expect(
      await t.query(internal.recipeIdeaAdmin.getOutstandingCount, {}),
    ).toBe(0);
  });

  test("validates content, honeypot, and five-per-hour rate limit", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.recipeIdeas.create, {
        participantKey,
        text: "   ",
        honeypot: "",
      }),
    ).rejects.toThrow("RECIPE_IDEA_TEXT_INVALID");
    await expect(
      t.mutation(api.recipeIdeas.create, {
        participantKey,
        text: "Une idée",
        honeypot: "robot",
      }),
    ).rejects.toThrow("RECIPE_IDEA_REJECTED");

    for (let index = 0; index < 5; index += 1) {
      await t.mutation(api.recipeIdeas.create, {
        participantKey,
        text: `Idée ${index}`,
        honeypot: "",
      });
    }
    await expect(
      t.mutation(api.recipeIdeas.create, {
        participantKey,
        text: "Une idée de trop",
        honeypot: "",
      }),
    ).rejects.toThrow("RECIPE_IDEA_RATE_LIMITED");
  });

  test("accepts exact content limits and rejects values beyond them", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.recipeIdeas.create, {
        participantKey,
        authorName: "N".repeat(60),
        text: "I".repeat(1500),
        honeypot: "",
      }),
    ).resolves.toHaveProperty("ideaId");
    await expect(
      t.mutation(api.recipeIdeas.create, {
        participantKey: `${participantKey}-text`,
        text: "I".repeat(1501),
        honeypot: "",
      }),
    ).rejects.toThrow("RECIPE_IDEA_TEXT_INVALID");
    await expect(
      t.mutation(api.recipeIdeas.create, {
        participantKey: `${participantKey}-name`,
        authorName: "N".repeat(61),
        text: "Une idée",
        honeypot: "",
      }),
    ).rejects.toThrow("RECIPE_IDEA_AUTHOR_INVALID");
  });

  test("paginates newest ideas without duplicates", async () => {
    const t = convexTest(schema, modules);
    const createdIds = [];
    for (let index = 0; index < 12; index += 1) {
      const created = await t.mutation(api.recipeIdeas.create, {
        participantKey: `${participantKey}-${index}`,
        text: `Idée paginée ${index}`,
        honeypot: "",
      });
      createdIds.push(created.ideaId);
    }
    const first = await t.query(api.recipeIdeas.list, {
      state: "outstanding",
      locale: "fr",
      participantKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    const second = await t.query(api.recipeIdeas.list, {
      state: "outstanding",
      locale: "fr",
      participantKey,
      paginationOpts: { numItems: 10, cursor: first.continueCursor },
    });
    expect(first.page).toHaveLength(10);
    expect(second.page).toHaveLength(2);
    expect([...first.page, ...second.page].map((idea) => idea._id)).toEqual(
      [...createdIds].reverse(),
    );
  });

  test("keeps the exact outstanding count under concurrent creates and deletes", async () => {
    const t = convexTest(schema, modules);
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        t.mutation(api.recipeIdeas.create, {
          participantKey: `${participantKey}-counter-${index}`,
          text: `Idée compteur ${index}`,
          honeypot: "",
        }),
      ),
    );
    expect(await t.query(internal.recipeIdeaAdmin.getOutstandingCount, {})).toBe(8);
    await Promise.all(
      created.map((idea, index) =>
        t.mutation(api.recipeIdeas.removeOwn, {
          ideaId: idea.ideaId,
          participantKey: `${participantKey}-counter-${index}`,
        }),
      ),
    );
    expect(await t.query(internal.recipeIdeaAdmin.getOutstandingCount, {})).toBe(0);
  });

  test("removes expired rate-limit windows while retaining active ones", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("recipeIdeaRateLimits", {
        participantDigest: "expired",
        windowStartedAt: now - 2 * 60 * 60 * 1000,
        count: 5,
      });
      await ctx.db.insert("recipeIdeaRateLimits", {
        participantDigest: "active",
        windowStartedAt: now,
        count: 1,
      });
    });
    await t.mutation(
      internal.recipeIdeaMaintenance.cleanupExpiredRateLimits,
      {},
    );
    const windows = await t.run((ctx) =>
      ctx.db.query("recipeIdeaRateLimits").collect(),
    );
    expect(windows.map((window) => window.participantDigest)).toEqual([
      "active",
    ]);
  });

  test("links conversion atomically and follows recipe visibility", async () => {
    const t = convexTest(schema, modules);
    const idea = await t.mutation(api.recipeIdeas.create, {
      participantKey,
      text: "La tarte aux mirabelles de mamie",
      honeypot: "",
    });
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe(),
      sourceIdeaId: idea.ideaId,
      adminPassword: password,
    });
    await expect(
      t.mutation(api.recipes.create, {
        recipe: recipe("Deuxième tarte"),
        sourceIdeaId: idea.ideaId,
        adminPassword: password,
      }),
    ).rejects.toThrow("RECIPE_IDEA_ALREADY_LINKED");

    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["image"], { type: "image/jpeg" })),
    );
    const withImage = await t.mutation(api.recipes.setHeroImage, {
      slug: created.slug,
      storageId,
      expectedRevision: created.revision,
      adminPassword: password,
    });
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: withImage.revision,
      adminPassword: password,
    });
    expect(await t.query(internal.recipeIdeaAdmin.getOutstandingCount, {})).toBe(0);

    let completed = await listIdeas(t, "completed");
    expect(completed.page[0]).toMatchObject({
      _id: idea.ideaId,
      canEdit: false,
      canDelete: true,
      linkedRecipe: {
        slug: created.slug,
        title: "Tarte issue d'une idée",
        isPublic: true,
      },
    });
    await expect(
      t.mutation(api.recipeIdeas.updateOwn, {
        ideaId: idea.ideaId,
        participantKey,
        text: "Texte changé après publication",
      }),
    ).rejects.toThrow("RECIPE_IDEA_EDIT_LOCKED");

    await t.mutation(api.recipes.unpublish, {
      slug: created.slug,
      adminPassword: password,
    });
    expect(await t.query(internal.recipeIdeaAdmin.getOutstandingCount, {})).toBe(1);
    expect((await listIdeas(t, "completed")).page).toHaveLength(0);
    expect((await listIdeas(t, "outstanding")).page[0].linkedRecipe).toBeNull();
    const privateIdea = await t.query(internal.recipeIdeaAdmin.get, {
      ideaId: idea.ideaId,
      locale: "fr",
    });
    expect(privateIdea?.linkedRecipe).toMatchObject({
      slug: created.slug,
      isPublic: false,
    });

    const beforeRepublish = await t.query(api.recipes.getForEditing, {
      slug: created.slug,
      locale: "fr",
      adminPassword: password,
    });
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: beforeRepublish?.revision ?? 0,
      adminPassword: password,
    });
    expect((await listIdeas(t, "completed")).page[0]._id).toBe(idea.ideaId);
    expect(await t.query(internal.recipeIdeaAdmin.getOutstandingCount, {})).toBe(0);
    await t.mutation(api.recipes.unpublish, {
      slug: created.slug,
      adminPassword: password,
    });

    const editing = await t.query(api.recipes.getForEditing, {
      slug: created.slug,
      locale: "fr",
      adminPassword: password,
    });
    await t.mutation(api.recipes.deleteRecipe, {
      slug: created.slug,
      expectedRevision: editing?.revision ?? 0,
      adminPassword: password,
    });
    const reopened = (await listIdeas(t, "outstanding")).page[0];
    expect(reopened.linkedRecipe).toBeNull();
    expect(await t.query(internal.recipeIdeaAdmin.getOutstandingCount, {})).toBe(1);
  });

  test("lets a contributor delete a completed idea without deleting its recipe", async () => {
    const t = convexTest(schema, modules);
    const idea = await t.mutation(api.recipeIdeas.create, {
      participantKey,
      text: "Un clafoutis aux cerises",
      honeypot: "",
    });
    const created = await t.mutation(api.recipes.create, {
      recipe: recipe("Clafoutis aux cerises"),
      sourceIdeaId: idea.ideaId,
      adminPassword: password,
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["image"], { type: "image/jpeg" })),
    );
    const withImage = await t.mutation(api.recipes.setHeroImage, {
      slug: created.slug,
      storageId,
      expectedRevision: created.revision,
      adminPassword: password,
    });
    await t.mutation(api.recipes.publishDraft, {
      slug: created.slug,
      expectedRevision: withImage.revision,
      adminPassword: password,
    });
    await t.mutation(api.recipeIdeas.removeOwn, {
      ideaId: idea.ideaId,
      participantKey,
    });
    expect((await listIdeas(t, "completed")).page).toHaveLength(0);
    expect(
      await t.query(api.recipes.getForEditing, {
        slug: created.slug,
        locale: "fr",
        adminPassword: password,
      }),
    ).not.toBeNull();
    expect(await t.query(internal.recipeIdeaAdmin.getOutstandingCount, {})).toBe(0);
  });

  test("admin ideas are public but only admin-managed", async () => {
    const t = convexTest(schema, modules);
    const created = await t.mutation(internal.recipeIdeaAdmin.create, {
      authorName: "Maman",
      text: "Retrouver la recette des bugnes",
    });
    expect((await listIdeas(t, "outstanding")).page[0]).toMatchObject({
      _id: created.ideaId,
      creatorKind: "admin",
      canEdit: false,
      canDelete: false,
    });
    await t.mutation(internal.recipeIdeaAdmin.remove, {
      ideaId: created.ideaId,
    });
    expect((await listIdeas(t, "outstanding")).page).toHaveLength(0);
  });

  test("protected admin lookup rejects malformed document identifiers safely", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(internal.recipeIdeaAdmin.get, {
        ideaId: "not-a-convex-id",
        locale: "fr",
      }),
    ).resolves.toBeNull();
    await expect(
      t.mutation(internal.recipeIdeaAdmin.remove, {
        ideaId: "not-a-convex-id",
      }),
    ).rejects.toThrow("RECIPE_IDEA_NOT_FOUND");
  });
});
