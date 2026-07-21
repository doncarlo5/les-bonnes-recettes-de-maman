import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const localeValidator = v.union(v.literal("fr"), v.literal("en"));
const stateValidator = v.union(
  v.literal("outstanding"),
  v.literal("completed"),
);
const ideaLimit = 5;
const hourMs = 60 * 60 * 1000;

export const list = query({
  args: {
    state: stateValidator,
    locale: localeValidator,
    participantKey: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const participantDigest = await digestParticipantKey(args.participantKey);
    const result = await ctx.db
      .query("recipeIdeas")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page.map((idea) =>
          presentIdea(ctx, idea, args.locale, participantDigest, false),
        ),
      ),
    };
  },
});

export const create = mutation({
  args: {
    participantKey: v.string(),
    authorName: v.optional(v.string()),
    text: v.string(),
    honeypot: v.string(),
  },
  handler: async (ctx, args) => {
    assertHoneypot(args.honeypot);
    const participantDigest = await digestParticipantKey(args.participantKey);
    const content = normalizeContent(args.authorName, args.text);
    await consumeRateLimit(ctx, participantDigest);
    const now = Date.now();
    const ideaId = await ctx.db.insert("recipeIdeas", {
      ...content,
      creator: { kind: "participant", ownerDigest: participantDigest },
      state: "outstanding",
      updatedAt: now,
    });
    await changeOutstandingCount(ctx, 1);
    return { ideaId };
  },
});

export const updateOwn = mutation({
  args: {
    ideaId: v.id("recipeIdeas"),
    participantKey: v.string(),
    authorName: v.optional(v.string()),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const idea = await requireOwnedIdea(ctx, args.ideaId, args.participantKey);
    if (idea.state !== "outstanding") throw new Error("RECIPE_IDEA_EDIT_LOCKED");
    await ctx.db.patch(idea._id, {
      ...normalizeContent(args.authorName, args.text),
      updatedAt: Date.now(),
    });
    return { ideaId: idea._id };
  },
});

export const removeOwn = mutation({
  args: {
    ideaId: v.id("recipeIdeas"),
    participantKey: v.string(),
  },
  handler: async (ctx, args) => {
    const idea = await requireOwnedIdea(ctx, args.ideaId, args.participantKey);
    await removeIdea(ctx, idea);
    return { ideaId: idea._id };
  },
});

export async function linkIdeaToRecipe(
  ctx: MutationCtx,
  ideaId: Id<"recipeIdeas">,
  recipeId: Id<"recipes">,
) {
  const idea = await ctx.db.get(ideaId);
  if (!idea) throw new Error("RECIPE_IDEA_NOT_FOUND");
  if (idea.state !== "outstanding" || idea.linkedRecipeId) {
    throw new Error("RECIPE_IDEA_ALREADY_LINKED");
  }
  await ctx.db.patch(idea._id, { linkedRecipeId: recipeId });
}

export async function completeLinkedIdea(
  ctx: MutationCtx,
  recipeId: Id<"recipes">,
) {
  const idea = await getLinkedIdea(ctx, recipeId);
  if (!idea || idea.state === "completed") return;
  await ctx.db.patch(idea._id, { state: "completed", updatedAt: Date.now() });
  await changeOutstandingCount(ctx, -1);
}

export async function reopenLinkedIdea(
  ctx: MutationCtx,
  recipeId: Id<"recipes">,
) {
  const idea = await getLinkedIdea(ctx, recipeId);
  if (!idea || idea.state === "outstanding") return;
  await ctx.db.patch(idea._id, { state: "outstanding", updatedAt: Date.now() });
  await changeOutstandingCount(ctx, 1);
}

export async function detachLinkedIdea(
  ctx: MutationCtx,
  recipeId: Id<"recipes">,
) {
  const idea = await getLinkedIdea(ctx, recipeId);
  if (!idea) return;
  if (idea.state === "completed") await changeOutstandingCount(ctx, 1);
  await ctx.db.patch(idea._id, {
    state: "outstanding",
    linkedRecipeId: undefined,
    updatedAt: Date.now(),
  });
}

async function presentIdea(
  ctx: QueryCtx,
  idea: Doc<"recipeIdeas">,
  locale: "fr" | "en",
  participantDigest: string | null,
  includeUnpublishedRecipe: boolean,
) {
  const recipe = idea.linkedRecipeId
    ? await ctx.db.get(idea.linkedRecipeId)
    : null;
  const isOwner =
    participantDigest !== null &&
    idea.creator.kind === "participant" &&
    idea.creator.ownerDigest === participantDigest;
  return {
    _id: idea._id,
    _creationTime: idea._creationTime,
    text: idea.text,
    authorName: idea.authorName ?? null,
    state: idea.state,
    updatedAt: idea.updatedAt,
    edited: idea.updatedAt > idea._creationTime + 1,
    creatorKind: idea.creator.kind,
    canEdit: isOwner && idea.state === "outstanding",
    canDelete: isOwner,
    linkedRecipe: recipe && (includeUnpublishedRecipe || recipe.status === "published")
      ? {
          slug: recipe.slug,
          title: recipe.translations[locale].title,
          isPublic: recipe.status === "published",
        }
      : null,
  };
}

export async function presentIdeaForAdmin(
  ctx: QueryCtx,
  idea: Doc<"recipeIdeas">,
  locale: "fr" | "en",
) {
  return presentIdea(ctx, idea, locale, null, true);
}

async function requireOwnedIdea(
  ctx: MutationCtx,
  ideaId: Id<"recipeIdeas">,
  participantKey: string,
) {
  const idea = await ctx.db.get(ideaId);
  if (!idea) throw new Error("RECIPE_IDEA_NOT_FOUND");
  const digest = await digestParticipantKey(participantKey);
  if (
    idea.creator.kind !== "participant" ||
    idea.creator.ownerDigest !== digest
  ) {
    throw new Error("RECIPE_IDEA_OWNER_REQUIRED");
  }
  return idea;
}

export async function removeIdea(ctx: MutationCtx, idea: Doc<"recipeIdeas">) {
  if (idea.state === "outstanding") await changeOutstandingCount(ctx, -1);
  await ctx.db.delete(idea._id);
}

async function getLinkedIdea(ctx: MutationCtx, recipeId: Id<"recipes">) {
  return await ctx.db
    .query("recipeIdeas")
    .withIndex("by_linkedRecipeId", (q) => q.eq("linkedRecipeId", recipeId))
    .unique();
}

export async function changeOutstandingCount(ctx: MutationCtx, delta: number) {
  const summary = await ctx.db
    .query("recipeIdeaSummaries")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  if (!summary) {
    if (delta < 0) throw new Error("RECIPE_IDEA_COUNT_INVALID");
    await ctx.db.insert("recipeIdeaSummaries", {
      key: "global",
      outstandingCount: delta,
    });
    return;
  }
  const outstandingCount = summary.outstandingCount + delta;
  if (outstandingCount < 0) throw new Error("RECIPE_IDEA_COUNT_INVALID");
  await ctx.db.patch(summary._id, { outstandingCount });
}

export function normalizeContent(authorName: string | undefined, text: string) {
  const normalizedName = authorName?.trim() || undefined;
  const normalizedText = text.trim();
  if (!normalizedText || normalizedText.length > 1500) {
    throw new Error("RECIPE_IDEA_TEXT_INVALID");
  }
  if (normalizedName && normalizedName.length > 60) {
    throw new Error("RECIPE_IDEA_AUTHOR_INVALID");
  }
  return { authorName: normalizedName, text: normalizedText };
}

async function consumeRateLimit(
  ctx: MutationCtx,
  participantDigest: string,
) {
  const now = Date.now();
  const current = await ctx.db
    .query("recipeIdeaRateLimits")
    .withIndex("by_participantDigest", (q) =>
      q.eq("participantDigest", participantDigest),
    )
    .unique();
  if (!current || current.windowStartedAt + hourMs <= now) {
    if (current) {
      await ctx.db.patch(current._id, { windowStartedAt: now, count: 1 });
    } else {
      await ctx.db.insert("recipeIdeaRateLimits", {
        participantDigest,
        windowStartedAt: now,
        count: 1,
      });
    }
    return;
  }
  if (current.count >= ideaLimit) throw new Error("RECIPE_IDEA_RATE_LIMITED");
  await ctx.db.patch(current._id, { count: current.count + 1 });
}

async function digestParticipantKey(participantKey: string) {
  if (participantKey.length < 24 || participantKey.length > 200) {
    throw new Error("PARTICIPANT_KEY_INVALID");
  }
  const bytes = new TextEncoder().encode(participantKey);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function assertHoneypot(value: string) {
  if (value) throw new Error("RECIPE_IDEA_REJECTED");
}
