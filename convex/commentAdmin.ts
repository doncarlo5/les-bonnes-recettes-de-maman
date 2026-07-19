import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { presentComment, removeComment } from "./commentModel";

export const list = internalQuery({
  args: { slug: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.query("recipes").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    if (!recipe) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("recipeComments")
      .withIndex("by_recipeId", (q) => q.eq("recipeId", recipe._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((comment) => presentComment(ctx, comment, null))),
    };
  },
});

export const remove = internalMutation({
  args: { commentId: v.id("recipeComments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) return null;
    await removeComment(ctx, comment);
    return null;
  },
});
