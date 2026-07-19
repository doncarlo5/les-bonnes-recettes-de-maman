/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const commentsApi = api.comments;
const internalCommentsApi = internal.comments;
const password = "test-password";
const ownerKey = "owner-browser-key-that-is-long-enough";
const otherKey = "another-browser-key-that-is-long-enough";
const firstLeaseId = "00000000-0000-4000-8000-000000000001";
const secondLeaseId = "00000000-0000-4000-8000-000000000002";
const onePixelPng = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), (character) => character.charCodeAt(0));
const onePixelJpeg = Uint8Array.from(atob("/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z"), (character) => character.charCodeAt(0));
const onePixelWebp = Uint8Array.from(atob("UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA="), (character) => character.charCodeAt(0));

async function insertRecipe(t: ReturnType<typeof convexTest>, status: "draft" | "published" = "published") {
  return await t.run(async (ctx) => {
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
    return await ctx.db.insert("recipes", {
      slug: "tarte-aux-pommes",
      heroImageUrl: "",
      defaultLocale: "fr",
      translations: { fr: localized, en: localized },
      tags: ["dessert"],
      status,
    });
  });
}

describe("recipe comments", () => {
  test("publishes a normalized anonymous comment and lists it for both locales", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);

    await t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      authorName: "   ",
      text: "  Très bonne recette !  ",
      honeypot: "",
    });

    const page = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toHaveLength(1);
    expect(page.page[0]).toMatchObject({
      authorName: null,
      text: "Très bonne recette !",
      canEdit: true,
      viewerReaction: null,
      thumbsUpCount: 0,
      thumbsDownCount: 0,
    });
  });

  test("only the originating browser can edit and delete its comment", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    const created = await t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      authorName: "Julien",
      text: "Délicieuse.",
      honeypot: "",
    });

    await expect(t.mutation(commentsApi.update, {
      commentId: created.commentId,
      participantKey: otherKey,
      authorName: "Intrus",
      text: "Altéré",
      photoAction: "keep",
    })).rejects.toThrow("COMMENT_OWNER_REQUIRED");

    await t.mutation(commentsApi.update, {
      commentId: created.commentId,
      participantKey: ownerKey,
      authorName: "Julien",
      text: "Encore meilleure le lendemain.",
      photoAction: "keep",
    });
    const page = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page[0]).toMatchObject({ text: "Encore meilleure le lendemain.", edited: true });

    await t.mutation(commentsApi.removeOwn, { commentId: created.commentId, participantKey: ownerKey });
    const empty = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(empty.page).toHaveLength(0);
  });

  test("keeps one reversible reaction per browser with atomic counters", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    const created = await t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "Testée et approuvée.",
      honeypot: "",
    });

    for (const direction of ["up", "down", null] as const) {
      await t.mutation(commentsApi.setReaction, {
        commentId: created.commentId,
        participantKey: otherKey,
        direction,
      });
    }
    const page = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: otherKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page[0]).toMatchObject({ viewerReaction: null, thumbsUpCount: 0, thumbsDownCount: 0 });
  });

  test("preserves comments while a recipe is unpublished and restores them on republication", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t);
    await t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "À conserver.",
      honeypot: "",
    });
    await t.run(async (ctx) => await ctx.db.patch(recipeId, { status: "draft" }));

    await expect(t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: otherKey,
      text: "Refusé.",
      honeypot: "",
    })).rejects.toThrow("RECIPE_NOT_PUBLIC");
    const hidden = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(hidden.page).toHaveLength(0);

    await t.run(async (ctx) => await ctx.db.patch(recipeId, { status: "published" }));
    const restored = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(restored.page).toHaveLength(1);
  });

  test("lets the administrator list and permanently remove a comment", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    const created = await t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "À modérer.",
      honeypot: "",
    });

    const adminPage = await t.query(commentsApi.listForModeration, {
      slug: "tarte-aux-pommes",
      adminPassword: password,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(adminPage.page[0]._id).toBe(created.commentId);
    await t.mutation(commentsApi.removeAsAdmin, { commentId: created.commentId, adminPassword: password });
    const after = await t.query(commentsApi.listForModeration, {
      slug: "tarte-aux-pommes",
      adminPassword: password,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(after.page).toHaveLength(0);
  });

  test("validates bounded content and the anti-bot field", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    await expect(t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: " ",
      honeypot: "",
    })).rejects.toThrow("COMMENT_TEXT_INVALID");
    await expect(t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      authorName: "a".repeat(61),
      text: "Valide",
      honeypot: "",
    })).rejects.toThrow("COMMENT_AUTHOR_INVALID");
    await expect(t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "Robot",
      honeypot: "https://spam.example",
    })).rejects.toThrow("COMMENT_REJECTED");
  });

  test("limits a browser to five new comments per hour", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    for (let index = 0; index < 5; index += 1) {
      await t.mutation(commentsApi.create, {
        slug: "tarte-aux-pommes",
        participantKey: ownerKey,
        text: `Commentaire ${index + 1}`,
        honeypot: "",
      });
    }
    await expect(t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "Commentaire de trop",
      honeypot: "",
    })).rejects.toThrow("COMMENT_RATE_LIMITED");
  });

  test("paginates from the newest comment in stable batches", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    for (let index = 0; index < 11; index += 1) {
      await t.mutation(commentsApi.create, {
        slug: "tarte-aux-pommes",
        participantKey: `${ownerKey}-${index}`,
        text: `Commentaire ${index + 1}`,
        honeypot: "",
      });
    }
    const first = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(first.page.map((comment: { text: string }) => comment.text)).toEqual([
      "Commentaire 11", "Commentaire 10", "Commentaire 9", "Commentaire 8", "Commentaire 7",
      "Commentaire 6", "Commentaire 5", "Commentaire 4", "Commentaire 3", "Commentaire 2",
    ]);
    const second = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      paginationOpts: { numItems: 10, cursor: first.continueCursor },
    });
    expect(second.page.map((comment: { text: string }) => comment.text)).toEqual(["Commentaire 1"]);
  });

  test("uploads and claims a valid photo while rejecting unsupported files and forged MIME types", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    const invalidForm = new FormData();
    invalidForm.set("slug", "tarte-aux-pommes");
    invalidForm.set("participantKey", otherKey);
    invalidForm.set("website", "");
    invalidForm.set("photo", new File(["svg-content"], "photo.svg", { type: "image/svg+xml" }));
    expect((await t.fetch("/comment-photo-upload", { method: "POST", body: invalidForm })).status).toBe(400);

    const validForm = new FormData();
    validForm.set("slug", "tarte-aux-pommes");
    validForm.set("participantKey", ownerKey);
    validForm.set("website", "");
    validForm.set("photo", new File([onePixelPng], "photo.png", { type: "image/png" }));
    const uploadResponse = await t.fetch("/comment-photo-upload", { method: "POST", body: validForm });
    expect(uploadResponse.status).toBe(200);
    const { storageId } = await uploadResponse.json() as { storageId: Id<"_storage"> };
    await expect(t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "Photo non vérifiée.",
      photoStorageId: storageId,
      honeypot: "",
    })).rejects.toThrow("COMMENT_PHOTO_NOT_VERIFIED");
    await t.mutation(commentsApi.beginPhotoVerification, { storageId, participantKey: ownerKey, leaseId: firstLeaseId });
    await expect(t.mutation(commentsApi.beginPhotoVerification, { storageId, participantKey: ownerKey, leaseId: secondLeaseId }))
      .rejects.toThrow("COMMENT_PHOTO_VERIFICATION_IN_PROGRESS");
    await t.run(async (ctx) => {
      const claim = await ctx.db.query("commentPhotoClaims").withIndex("by_storageId", (q) => q.eq("storageId", storageId)).unique();
      if (!claim) throw new Error("missing claim");
      await ctx.db.patch(claim._id, { verificationStartedAt: Date.now() - 6 * 60 * 1000 });
    });
    await t.mutation(commentsApi.beginPhotoVerification, { storageId, participantKey: ownerKey, leaseId: secondLeaseId });
    await t.mutation(commentsApi.markPhotoVerified, { storageId, participantKey: ownerKey, leaseId: secondLeaseId, adminPassword: password });
    await expect(t.mutation(commentsApi.discardPhotoVerification, { storageId, participantKey: ownerKey, leaseId: firstLeaseId, adminPassword: password }))
      .rejects.toThrow("COMMENT_PHOTO_VERIFICATION_REQUIRED");
    expect(await t.run(async (ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull();
    await expect(t.mutation(commentsApi.beginPhotoVerification, { storageId, participantKey: ownerKey, leaseId: firstLeaseId }))
      .rejects.toThrow("COMMENT_PHOTO_ALREADY_VERIFIED");
    await t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "Avec une photo.",
      photoStorageId: storageId,
      honeypot: "",
    });
    const page = await t.query(commentsApi.list, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page[0].photoUrl).toMatch(/^https:\/\//);

    const forgedForm = new FormData();
    forgedForm.set("slug", "tarte-aux-pommes");
    forgedForm.set("participantKey", otherKey);
    forgedForm.set("website", "");
    forgedForm.set("photo", new File(["not-an-image"], "photo.jpg", { type: "image/jpeg" }));
    expect((await t.fetch("/comment-photo-upload", { method: "POST", body: forgedForm })).status).toBe(400);

    const oversizedDimensions = onePixelPng.slice();
    oversizedDimensions.set([0, 0, 0x23, 0x28], 16);
    const oversizedForm = new FormData();
    oversizedForm.set("slug", "tarte-aux-pommes");
    oversizedForm.set("participantKey", otherKey);
    oversizedForm.set("website", "");
    oversizedForm.set("photo", new File([oversizedDimensions], "oversized.png", { type: "image/png" }));
    expect((await t.fetch("/comment-photo-upload", { method: "POST", body: oversizedForm })).status).toBe(400);

    for (const [mimeType, bytes, extension] of [
      ["image/jpeg", onePixelJpeg, "jpg"],
      ["image/webp", onePixelWebp, "webp"],
    ] as const) {
      const supportedForm = new FormData();
      supportedForm.set("slug", "tarte-aux-pommes");
      supportedForm.set("participantKey", otherKey);
      supportedForm.set("website", "");
      supportedForm.set("photo", new File([bytes], `photo.${extension}`, { type: mimeType }));
      expect((await t.fetch("/comment-photo-upload", { method: "POST", body: supportedForm })).status).toBe(200);
    }
  });

  test("limits photo upload grants and reaction changes independently", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    for (let index = 0; index < 5; index += 1) {
      await t.mutation(internalCommentsApi.authorizePhotoUpload, {
        slug: "tarte-aux-pommes",
        participantKey: ownerKey,
        honeypot: "",
      });
    }
    await expect(t.mutation(internalCommentsApi.authorizePhotoUpload, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      honeypot: "",
    })).rejects.toThrow("COMMENT_RATE_LIMITED");

    const created = await t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "À évaluer.",
      honeypot: "",
    });
    for (let index = 0; index < 60; index += 1) {
      await t.mutation(commentsApi.setReaction, {
        commentId: created.commentId,
        participantKey: otherKey,
        direction: index % 2 === 0 ? "up" : "down",
      });
    }
    await expect(t.mutation(commentsApi.setReaction, {
      commentId: created.commentId,
      participantKey: otherKey,
      direction: null,
    })).rejects.toThrow("COMMENT_RATE_LIMITED");
  });

  test("keeps reactions through edits and cleans them after deletion", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      await insertRecipe(t);
      const created = await t.mutation(commentsApi.create, {
        slug: "tarte-aux-pommes",
        participantKey: ownerKey,
        text: "Avant modification.",
        honeypot: "",
      });
      await t.mutation(commentsApi.setReaction, {
        commentId: created.commentId,
        participantKey: otherKey,
        direction: "up",
      });
      await t.mutation(commentsApi.update, {
        commentId: created.commentId,
        participantKey: ownerKey,
        authorName: "Julien",
        text: "Après modification.",
        photoAction: "keep",
      });
      const page = await t.query(commentsApi.list, {
        slug: "tarte-aux-pommes",
        participantKey: otherKey,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(page.page[0]).toMatchObject({ text: "Après modification.", viewerReaction: "up", thumbsUpCount: 1 });
      await t.mutation(commentsApi.removeOwn, { commentId: created.commentId, participantKey: ownerKey });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.run(async (ctx) => ctx.db.query("commentReactions").collect())).toHaveLength(0);
      expect(await t.run(async (ctx) => ctx.db.query("commentReactionSummaries").collect())).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test("replaces, removes, and deletes comment photos from storage", async () => {
    const t = convexTest(schema, modules);
    await insertRecipe(t);
    const firstStorageId = await uploadPng(t, ownerKey);
    const created = await t.mutation(commentsApi.create, {
      slug: "tarte-aux-pommes",
      participantKey: ownerKey,
      text: "Avec photo.",
      photoStorageId: firstStorageId,
      honeypot: "",
    });

    const replacementStorageId = await uploadPng(t, ownerKey);
    await t.mutation(commentsApi.update, {
      commentId: created.commentId,
      participantKey: ownerKey,
      text: "Photo remplacée.",
      photoAction: "replace",
      photoStorageId: replacementStorageId,
    });
    expect(await t.run(async (ctx) => ctx.db.system.get("_storage", firstStorageId))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get("_storage", replacementStorageId))).not.toBeNull();

    await t.mutation(commentsApi.update, {
      commentId: created.commentId,
      participantKey: ownerKey,
      text: "Photo retirée.",
      photoAction: "remove",
    });
    expect(await t.run(async (ctx) => ctx.db.system.get("_storage", replacementStorageId))).toBeNull();

    const finalStorageId = await uploadPng(t, ownerKey);
    await t.mutation(commentsApi.update, {
      commentId: created.commentId,
      participantKey: ownerKey,
      text: "Photo finale.",
      photoAction: "replace",
      photoStorageId: finalStorageId,
    });
    await t.mutation(commentsApi.removeOwn, { commentId: created.commentId, participantKey: ownerKey });
    expect(await t.run(async (ctx) => ctx.db.system.get("_storage", finalStorageId))).toBeNull();
  });

  test("cleans expired rate-limit windows in bounded batches", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const now = Date.now();
      await t.run(async (ctx) => {
        for (let index = 0; index < 101; index += 1) {
          await ctx.db.insert("commentRateLimits", {
            participantDigest: `expired-${index}`,
            action: "comment",
            windowStartedAt: now - 2 * 60 * 60 * 1000,
            count: 1,
          });
        }
        await ctx.db.insert("commentRateLimits", {
          participantDigest: "current",
          action: "comment",
          windowStartedAt: now,
          count: 1,
        });
      });
      await t.mutation(internalCommentsApi.cleanupExpiredRateLimits, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const remaining = await t.run(async (ctx) => ctx.db.query("commentRateLimits").collect());
      expect(remaining).toHaveLength(1);
      expect(remaining[0].participantDigest).toBe("current");
    } finally {
      vi.useRealTimers();
    }
  });
});

async function uploadPng(t: ReturnType<typeof convexTest>, participantKey: string) {
  const form = new FormData();
  form.set("slug", "tarte-aux-pommes");
  form.set("participantKey", participantKey);
  form.set("website", "");
  form.set("photo", new File([onePixelPng], "photo.png", { type: "image/png" }));
  const response = await t.fetch("/comment-photo-upload", { method: "POST", body: form });
  expect(response.status).toBe(200);
  const storageId = ((await response.json()) as { storageId: Id<"_storage"> }).storageId;
  await t.mutation(commentsApi.beginPhotoVerification, { storageId, participantKey, leaseId: firstLeaseId });
  await t.mutation(commentsApi.markPhotoVerified, { storageId, participantKey, leaseId: firstLeaseId, adminPassword: password });
  return storageId;
}
