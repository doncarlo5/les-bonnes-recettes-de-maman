import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  changeOutstandingCount,
  normalizeContent,
  presentIdeaForAdmin,
  removeIdea,
} from "./recipeIdeas";

const localeValidator = v.union(v.literal("fr"), v.literal("en"));
const stateValidator = v.union(
  v.literal("outstanding"),
  v.literal("completed"),
);

export const list = internalQuery({
  args: {
    state: stateValidator,
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("recipeIdeas")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map((idea) => presentIdeaForAdmin(ctx, idea, args.locale)),
      ),
    };
  },
});

export const get = internalQuery({
  args: { ideaId: v.string(), locale: localeValidator },
  handler: async (ctx, args) => {
    const ideaId = ctx.db.normalizeId("recipeIdeas", args.ideaId);
    if (!ideaId) return null;
    const idea = await ctx.db.get(ideaId);
    return idea ? presentIdeaForAdmin(ctx, idea, args.locale) : null;
  },
});

export const getOutstandingCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const summary = await ctx.db
      .query("recipeIdeaSummaries")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    return summary?.outstandingCount ?? 0;
  },
});

export const create = internalMutation({
  args: { authorName: v.optional(v.string()), text: v.string() },
  handler: async (ctx, args) => {
    const ideaId = await ctx.db.insert("recipeIdeas", {
      ...normalizeContent(args.authorName, args.text),
      creator: { kind: "admin" },
      state: "outstanding",
      updatedAt: Date.now(),
    });
    await changeOutstandingCount(ctx, 1);
    return { ideaId };
  },
});

export const remove = internalMutation({
  args: { ideaId: v.string() },
  handler: async (ctx, args) => {
    const ideaId = ctx.db.normalizeId("recipeIdeas", args.ideaId);
    if (!ideaId) throw new Error("RECIPE_IDEA_NOT_FOUND");
    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("RECIPE_IDEA_NOT_FOUND");
    await removeIdea(ctx, idea);
    return { ideaId: idea._id };
  },
});
