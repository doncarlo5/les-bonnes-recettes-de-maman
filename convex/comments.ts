import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  changeRecipeCommentCount,
  presentComment,
  removeComment,
} from "./commentModel";

declare const process: { env: { RECIPE_ADMIN_PASSWORD?: string } };

const reactionValidator = v.union(v.literal("up"), v.literal("down"));
const photoActionValidator = v.union(
  v.literal("keep"),
  v.literal("remove"),
  v.literal("replace"),
);
const hourMs = 60 * 60 * 1000;
const rateLimitMaximums = { comment: 5, photo: 5, reaction: 60 } as const;

export const list = query({
  args: {
    slug: v.string(),
    participantKey: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const [participantDigest, recipe] = await Promise.all([
      digestParticipantKey(args.participantKey),
      getRecipeBySlug(ctx, args.slug),
    ]);
    if (!recipe || recipe.status !== "published") {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("recipeComments")
      .withIndex("by_recipeId", (q) => q.eq("recipeId", recipe._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map((comment) => presentComment(ctx, comment, participantDigest)),
      ),
    };
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    participantKey: v.string(),
    authorName: v.optional(v.string()),
    text: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
    honeypot: v.string(),
  },
  handler: async (ctx, args) => {
    assertHoneypot(args.honeypot);
    const [participantDigest, recipe] = await Promise.all([
      digestParticipantKey(args.participantKey),
      requirePublishedRecipe(ctx, args.slug),
    ]);
    const content = normalizeContent(args.authorName, args.text);
    await consumeRateLimit(ctx, participantDigest, "comment");
    const photoClaim = args.photoStorageId
      ? await requirePhotoClaim(ctx, args.photoStorageId, participantDigest)
      : null;
    const countedAt = Date.now();
    const commentId = await ctx.db.insert("recipeComments", {
      recipeId: recipe._id,
      ownerDigest: participantDigest,
      text: content.text,
      countedAt,
      ...(content.authorName ? { authorName: content.authorName } : {}),
      ...(args.photoStorageId ? { photoStorageId: args.photoStorageId } : {}),
    });
    await ctx.db.insert("commentReactionSummaries", {
      commentId,
      thumbsUpCount: 0,
      thumbsDownCount: 0,
    });
    await changeRecipeCommentCount(ctx, recipe._id, 1);
    if (photoClaim) await ctx.db.delete(photoClaim._id);
    return { commentId };
  },
});

export const update = mutation({
  args: {
    commentId: v.id("recipeComments"),
    participantKey: v.string(),
    authorName: v.optional(v.string()),
    text: v.string(),
    photoAction: photoActionValidator,
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const comment = await requireOwnedComment(ctx, args.commentId, args.participantKey);
    await requirePublishedRecipeById(ctx, comment.recipeId);
    const content = normalizeContent(args.authorName, args.text);
    let nextPhotoStorageId = comment.photoStorageId;
    if (args.photoAction === "replace") {
      if (!args.photoStorageId) throw new Error("COMMENT_PHOTO_REQUIRED");
      const participantDigest = await digestParticipantKey(args.participantKey);
      const photoClaim = await requirePhotoClaim(ctx, args.photoStorageId, participantDigest);
      await ctx.db.delete(photoClaim._id);
      nextPhotoStorageId = args.photoStorageId;
    } else if (args.photoAction === "remove") {
      nextPhotoStorageId = undefined;
    }
    await ctx.db.patch(comment._id, {
      text: content.text,
      authorName: content.authorName,
      photoStorageId: nextPhotoStorageId,
      updatedAt: Date.now(),
    });
    if (comment.photoStorageId && comment.photoStorageId !== nextPhotoStorageId) {
      await ctx.storage.delete(comment.photoStorageId);
    }
    return { commentId: comment._id };
  },
});

export const removeOwn = mutation({
  args: { commentId: v.id("recipeComments"), participantKey: v.string() },
  handler: async (ctx, args) => {
    const comment = await requireOwnedComment(ctx, args.commentId, args.participantKey);
    await removeComment(ctx, comment);
    return null;
  },
});

export const setReaction = mutation({
  args: {
    commentId: v.id("recipeComments"),
    participantKey: v.string(),
    direction: v.union(reactionValidator, v.null()),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("COMMENT_NOT_FOUND");
    await requirePublishedRecipeById(ctx, comment.recipeId);
    const participantDigest = await digestParticipantKey(args.participantKey);
    await consumeRateLimit(ctx, participantDigest, "reaction");
    const [existing, summary] = await Promise.all([
      ctx.db
        .query("commentReactions")
        .withIndex("by_commentId_and_participantDigest", (q) =>
          q.eq("commentId", args.commentId).eq("participantDigest", participantDigest),
        )
        .unique(),
      getOrCreateSummary(ctx, args.commentId),
    ]);
    let thumbsUpCount = summary.thumbsUpCount;
    let thumbsDownCount = summary.thumbsDownCount;
    if (existing?.direction === "up") thumbsUpCount -= 1;
    if (existing?.direction === "down") thumbsDownCount -= 1;
    if (args.direction === "up") thumbsUpCount += 1;
    if (args.direction === "down") thumbsDownCount += 1;
    if (!args.direction) {
      if (existing) await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.patch(existing._id, { direction: args.direction, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("commentReactions", {
        commentId: args.commentId,
        participantDigest,
        direction: args.direction,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(summary._id, { thumbsUpCount, thumbsDownCount });
    return { direction: args.direction, thumbsUpCount, thumbsDownCount };
  },
});

export const authorizePhotoUpload = internalMutation({
  args: { slug: v.string(), participantKey: v.string(), honeypot: v.string() },
  handler: async (ctx, args) => {
    assertHoneypot(args.honeypot);
    await requirePublishedRecipe(ctx, args.slug);
    const participantDigest = await digestParticipantKey(args.participantKey);
    await consumeRateLimit(ctx, participantDigest, "photo");
    return participantDigest;
  },
});

export const recordPhotoClaim = internalMutation({
  args: { storageId: v.id("_storage"), participantDigest: v.string() },
  handler: async (ctx, args) => {
    const [existing, used] = await Promise.all([
      ctx.db.query("commentPhotoClaims").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).unique(),
      ctx.db.query("recipeComments").withIndex("by_photoStorageId", (q) => q.eq("photoStorageId", args.storageId)).first(),
    ]);
    if (existing || used) throw new Error("COMMENT_PHOTO_ALREADY_CLAIMED");
    await ctx.db.insert("commentPhotoClaims", { storageId: args.storageId, participantDigest: args.participantDigest, createdAt: Date.now() });
    return null;
  },
});

export const beginPhotoVerification = mutation({
  args: { storageId: v.id("_storage"), participantKey: v.string(), leaseId: v.string() },
  handler: async (ctx, args) => {
    assertLeaseId(args.leaseId);
    const [participantDigest, claim] = await Promise.all([
      digestParticipantKey(args.participantKey),
      ctx.db.query("commentPhotoClaims").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).unique(),
    ]);
    if (!claim || claim.participantDigest !== participantDigest) throw new Error("COMMENT_PHOTO_OWNER_REQUIRED");
    if (claim.verifiedAt) throw new Error("COMMENT_PHOTO_ALREADY_VERIFIED");
    if (claim.verificationStartedAt && claim.verificationStartedAt > Date.now() - 5 * 60 * 1000) {
      throw new Error("COMMENT_PHOTO_VERIFICATION_IN_PROGRESS");
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("COMMENT_PHOTO_NOT_FOUND");
    await ctx.db.patch(claim._id, { verificationStartedAt: Date.now(), verificationLeaseId: args.leaseId });
    return { url };
  },
});

export const markPhotoVerified = mutation({
  args: { storageId: v.id("_storage"), participantKey: v.string(), leaseId: v.string(), adminPassword: v.string() },
  handler: async (ctx, args) => {
    assertAdminPassword(args.adminPassword);
    assertLeaseId(args.leaseId);
    const [participantDigest, claim, storedPhoto] = await Promise.all([
      digestParticipantKey(args.participantKey),
      ctx.db.query("commentPhotoClaims").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).unique(),
      ctx.db.system.get("_storage", args.storageId),
    ]);
    if (!claim || claim.participantDigest !== participantDigest) throw new Error("COMMENT_PHOTO_OWNER_REQUIRED");
    if (!storedPhoto) throw new Error("COMMENT_PHOTO_NOT_FOUND");
    if (!claim.verificationStartedAt || claim.verificationLeaseId !== args.leaseId) throw new Error("COMMENT_PHOTO_VERIFICATION_REQUIRED");
    await ctx.db.patch(claim._id, { verificationStartedAt: undefined, verificationLeaseId: undefined, verifiedAt: Date.now() });
    return null;
  },
});

export const discardPhotoVerification = mutation({
  args: { storageId: v.id("_storage"), participantKey: v.string(), leaseId: v.string(), adminPassword: v.string() },
  handler: async (ctx, args) => {
    assertAdminPassword(args.adminPassword);
    assertLeaseId(args.leaseId);
    const [participantDigest, claim] = await Promise.all([
      digestParticipantKey(args.participantKey),
      ctx.db.query("commentPhotoClaims").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).unique(),
    ]);
    if (!claim || claim.participantDigest !== participantDigest || claim.verificationLeaseId !== args.leaseId || claim.verifiedAt) {
      throw new Error("COMMENT_PHOTO_VERIFICATION_REQUIRED");
    }
    if (await ctx.db.system.get("_storage", args.storageId)) await ctx.storage.delete(args.storageId);
    await ctx.db.delete(claim._id);
    return null;
  },
});

export const discardPhoto = mutation({
  args: { storageId: v.id("_storage"), participantKey: v.string() },
  handler: async (ctx, args) => {
    const [participantDigest, claim] = await Promise.all([
      digestParticipantKey(args.participantKey),
      ctx.db.query("commentPhotoClaims").withIndex("by_storageId", (q) => q.eq("storageId", args.storageId)).unique(),
    ]);
    if (!claim || claim.participantDigest !== participantDigest) throw new Error("COMMENT_PHOTO_OWNER_REQUIRED");
    if (await ctx.db.system.get("_storage", args.storageId)) await ctx.storage.delete(args.storageId);
    await ctx.db.delete(claim._id);
    return null;
  },
});

async function requireOwnedComment(ctx: MutationCtx, commentId: Id<"recipeComments">, participantKey: string) {
  const comment = await ctx.db.get(commentId);
  if (!comment) throw new Error("COMMENT_NOT_FOUND");
  const digest = await digestParticipantKey(participantKey);
  if (comment.ownerDigest !== digest) throw new Error("COMMENT_OWNER_REQUIRED");
  return comment;
}

async function getOrCreateSummary(ctx: MutationCtx, commentId: Id<"recipeComments">) {
  const existing = await ctx.db.query("commentReactionSummaries").withIndex("by_commentId", (q) => q.eq("commentId", commentId)).unique();
  if (existing) return existing;
  const id = await ctx.db.insert("commentReactionSummaries", { commentId, thumbsUpCount: 0, thumbsDownCount: 0 });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("COMMENT_SUMMARY_NOT_FOUND");
  return created;
}

async function getRecipeBySlug(ctx: QueryCtx | MutationCtx, slug: string) {
  return await ctx.db.query("recipes").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
}

async function requirePublishedRecipe(ctx: MutationCtx, slug: string) {
  const recipe = await getRecipeBySlug(ctx, slug);
  if (!recipe || recipe.status !== "published") throw new Error("RECIPE_NOT_PUBLIC");
  return recipe;
}

async function requirePublishedRecipeById(ctx: MutationCtx, recipeId: Id<"recipes">) {
  const recipe = await ctx.db.get(recipeId);
  if (!recipe || recipe.status !== "published") throw new Error("RECIPE_NOT_PUBLIC");
  return recipe;
}

function normalizeContent(authorName: string | undefined, text: string) {
  const normalizedName = authorName?.trim() || undefined;
  const normalizedText = text.trim();
  if (!normalizedText || normalizedText.length > 1500) throw new Error("COMMENT_TEXT_INVALID");
  if (normalizedName && normalizedName.length > 60) throw new Error("COMMENT_AUTHOR_INVALID");
  return { authorName: normalizedName, text: normalizedText };
}

async function requirePhotoClaim(ctx: MutationCtx, storageId: Id<"_storage">, participantDigest: string) {
  const claim = await ctx.db.query("commentPhotoClaims").withIndex("by_storageId", (q) => q.eq("storageId", storageId)).unique();
  if (!claim || claim.participantDigest !== participantDigest) throw new Error("COMMENT_PHOTO_OWNER_REQUIRED");
  if (!claim.verifiedAt) throw new Error("COMMENT_PHOTO_NOT_VERIFIED");
  return claim;
}

async function digestParticipantKey(participantKey: string) {
  if (participantKey.length < 24 || participantKey.length > 200) throw new Error("PARTICIPANT_KEY_INVALID");
  const bytes = new TextEncoder().encode(participantKey);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(
  ctx: MutationCtx,
  participantDigest: string,
  action: keyof typeof rateLimitMaximums,
) {
  const now = Date.now();
  const current = await ctx.db.query("commentRateLimits").withIndex("by_participantDigest_and_action", (q) => q.eq("participantDigest", participantDigest).eq("action", action)).unique();
  if (!current || current.windowStartedAt + hourMs <= now) {
    if (current) await ctx.db.patch(current._id, { windowStartedAt: now, count: 1 });
    else await ctx.db.insert("commentRateLimits", { participantDigest, action, windowStartedAt: now, count: 1 });
    return;
  }
  if (current.count >= rateLimitMaximums[action]) throw new Error("COMMENT_RATE_LIMITED");
  await ctx.db.patch(current._id, { count: current.count + 1 });
}

function assertHoneypot(value: string) {
  if (value) throw new Error("COMMENT_REJECTED");
}

function assertLeaseId(value: string) {
  if (!/^[a-f0-9-]{36}$/.test(value)) throw new Error("COMMENT_PHOTO_LEASE_INVALID");
}

function assertAdminPassword(password: string) {
  if (!process.env.RECIPE_ADMIN_PASSWORD || password !== process.env.RECIPE_ADMIN_PASSWORD) {
    throw new Error("RECIPE_ADMIN_REQUIRED");
  }
}
