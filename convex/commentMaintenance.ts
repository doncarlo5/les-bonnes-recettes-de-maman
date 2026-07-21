import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { removeComment } from "./commentModel";

const hourMs = 60 * 60 * 1000;

export const cleanupRecipeComments = internalMutation({
  args: { recipeId: v.id("recipes") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("recipeComments")
      .withIndex("by_recipeId", (q) => q.eq("recipeId", args.recipeId))
      .take(25);
    for (const comment of comments) {
      await removeComment(ctx, comment);
    }
    if (comments.length === 25) {
      await ctx.scheduler.runAfter(
        0,
        internal.commentMaintenance.cleanupRecipeComments,
        { recipeId: args.recipeId },
      );
    }
    return null;
  },
});

export const cleanupReactions = internalMutation({
  args: { commentId: v.id("recipeComments") },
  handler: async (ctx, args) => {
    const reactions = await ctx.db
      .query("commentReactions")
      .withIndex("by_commentId", (q) => q.eq("commentId", args.commentId))
      .take(100);
    for (const reaction of reactions) await ctx.db.delete(reaction._id);
    if (reactions.length === 100) {
      await ctx.scheduler.runAfter(0, internal.commentMaintenance.cleanupReactions, { commentId: args.commentId });
    }
    return null;
  },
});

export const cleanupUnreferencedStorage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const claims = await ctx.db
      .query("commentPhotoClaims")
      .withIndex("by_createdAt")
      .order("asc")
      .take(50);
    const cutoff = Date.now() - 24 * hourMs;
    let removed = 0;
    for (const claim of claims) {
      if (claim.createdAt >= cutoff) break;
      if (await ctx.db.system.get("_storage", claim.storageId)) await ctx.storage.delete(claim.storageId);
      await ctx.db.delete(claim._id);
      removed += 1;
    }
    if (removed === 50) {
      await ctx.scheduler.runAfter(0, internal.commentMaintenance.cleanupUnreferencedStorage, {});
    }
    return null;
  },
});

export const cleanupExpiredRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("commentRateLimits")
      .withIndex("by_windowStartedAt", (q) => q.lt("windowStartedAt", Date.now() - hourMs))
      .take(100);
    for (const window of expired) await ctx.db.delete(window._id);
    if (expired.length === 100) {
      await ctx.scheduler.runAfter(0, internal.commentMaintenance.cleanupExpiredRateLimits, {});
    }
    return null;
  },
});
