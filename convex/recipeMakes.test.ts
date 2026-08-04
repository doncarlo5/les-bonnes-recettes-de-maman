/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const serverSecret = "test-password";

async function insertRecipe(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) => {
    const localized = {
      title: "Tarte aux pommes",
      author: "Maman",
      description: "Une tarte familiale.",
      servings: null,
      yieldLabel: "6 personnes",
      prepTime: "20 min",
      cookTime: "30 min",
      totalTime: "50 min",
      timeLabel: "50 min",
      temperature: "180 °C",
      ingredients: [],
      sections: [],
      subRecipes: [],
      notes: [],
    };
    return ctx.db.insert("recipes", {
      slug: "tarte-aux-pommes",
      heroImageUrl: "",
      defaultLocale: "fr",
      translations: { fr: localized, en: localized },
      categories: ["dessert"],
      status: "published",
    });
  });
}

async function publishMake(
  t: ReturnType<typeof convexTest>,
  participantDigest: string,
  caption: string,
) {
  const ticket = await t.mutation(api.recipeMakes.requestUploadTicket, {
    serverSecret,
    slug: "tarte-aux-pommes",
    participantDigest,
  });
  const [fullPhotoStorageId, thumbnailStorageId] = await t.run((ctx) =>
    Promise.all([
      ctx.storage.store(new Blob([`full-${caption}`], { type: "image/webp" })),
      ctx.storage.store(new Blob([`thumb-${caption}`], { type: "image/webp" })),
    ]),
  );
  await t.mutation(internal.recipeMakes.finalizeUpload, {
    slug: "tarte-aux-pommes",
    ticketDigest: ticket.ticketDigest,
    fullPhotoStorageId,
    thumbnailStorageId,
    caption,
  });
}

describe("recipe Réalisations", () => {
  test("allows multiple makes, exact counts, unique Bravos, reports, and owner deletion", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    const owner = "owner-session-digest";
    const viewer = "viewer-session-digest";

    await publishMake(t, owner, "Première tarte");
    await publishMake(t, owner, "Deuxième tarte");

    const preview = await t.query(api.recipeMakes.listPreview, {
      slug: "tarte-aux-pommes",
      participantDigest: owner,
    });
    expect(preview.resultsCount).toBe(2);
    expect(preview.page.map((make) => make.caption)).toEqual([
      "Deuxième tarte",
      "Première tarte",
    ]);
    expect(preview.page.every((make) => make.isAuthor)).toBe(true);

    const makeId = preview.page[0]!._id;
    await expect(t.mutation(api.recipeMakes.toggleBravo, {
      serverSecret,
      makeId,
      participantDigest: viewer,
    })).resolves.toMatchObject({ bravoCount: 1, hasBravo: true });
    await expect(t.mutation(api.recipeMakes.toggleBravo, {
      serverSecret,
      makeId,
      participantDigest: viewer,
    })).resolves.toMatchObject({ bravoCount: 0, hasBravo: false });

    const firstReport = await t.mutation(api.recipeMakes.report, {
      serverSecret,
      makeId,
      participantDigest: viewer,
      reason: "privacy",
      details: "Une personne est identifiable.",
    });
    await expect(t.mutation(api.recipeMakes.report, {
      serverSecret,
      makeId,
      participantDigest: viewer,
      reason: "privacy",
    })).resolves.toMatchObject({ reportId: firstReport.reportId });

    await t.mutation(api.recipeMakes.removeOwn, { serverSecret, makeId, participantDigest: owner });
    const afterDeletion = await t.query(api.recipeMakes.listPreview, {
      slug: "tarte-aux-pommes",
      participantDigest: owner,
    });
    expect(afterDeletion.resultsCount).toBe(1);
    expect(afterDeletion.page).toHaveLength(1);
  });
});
