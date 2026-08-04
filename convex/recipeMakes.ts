import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const maxPublicationAttemptsPerHour = 3;
const maxPublicationAttemptsPerDay = 10;

const publicationWindow = 15 * 60 * 1000;
const makePurgeDelay = 30 * dayMs;

type RecipeMake = Doc<"recipeMakes">;
type MakePresentation = {
  _id: Id<"recipeMakes">;
  _creationTime: number;
  authorName: string | null;
  caption: string | null;
  altText: string | null;
  fullPhotoUrl: string | null;
  thumbnailUrl: string | null;
  isAuthor: boolean;
  viewerHasBravo: boolean;
  viewerHasReported: boolean;
  bravoCount: number;
  reportCount: number;
  canEdit: boolean;
  canReport: boolean;
  edited: boolean;
};

type AdminMakePresentation = {
  _id: Id<"recipeMakes">;
  _creationTime: number;
  authorName: string | null;
  caption: string | null;
  altText: string | null;
  fullPhotoUrl: string | null;
  thumbnailUrl: string | null;
  reportCount: number;
  state: "published" | "removed" | "blocked";
};

type ModerationQueueItem = {
  make: MakePresentation;
  openReportCount: number;
  totalReportCount: number;
};

export const list = query({
  args: {
    slug: v.string(),
    participantDigest: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const recipe = await getRecipeBySlug(ctx, args.slug);
    if (!recipe || recipe.status !== "published") {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const result = await ctx.db
      .query("recipeMakes")
      .withIndex("by_recipeId_and_state", (q) =>
        q.eq("recipeId", recipe._id).eq("state", "published"),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page.map((make) => presentMake(ctx, make, args.participantDigest ?? null)),
      ),
      resultsCount: (await getMakeSummary(ctx, recipe._id))?.makeCount ?? 0,
    };
  },
});

export const listPreview = query({
  args: {
    slug: v.string(),
    participantDigest: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipe = await getRecipeBySlug(ctx, args.slug);
    if (!recipe || recipe.status !== "published") {
      return { page: [], resultsCount: 0, hasMore: false };
    }

    const result = await ctx.db
      .query("recipeMakes")
      .withIndex("by_recipeId_and_state", (q) =>
        q.eq("recipeId", recipe._id).eq("state", "published"),
      )
      .order("desc")
      .take(4);

    return {
      page: await Promise.all(
        result.map((make) => presentMake(ctx, make, args.participantDigest ?? null)),
      ),
      resultsCount: (await getMakeSummary(ctx, recipe._id))?.makeCount ?? 0,
      hasMore: result.length === 4,
    };
  },
});

export const listModerationQueue = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("recipeMakeReportSummaries")
      .withIndex("by_openReportCount")
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (summary) => {
        if (summary.openReportCount <= 0) return null;
        const make = await ctx.db.get(summary.makeId);
        if (!make) return null;
        return {
          make: await presentMake(ctx, make, null),
          openReportCount: summary.openReportCount,
          totalReportCount: summary.totalReportCount,
        };
      }),
    );

    return {
      ...result,
      page: page.filter((entry): entry is ModerationQueueItem => entry !== null),
    };
  },
});

export const requestUploadTicket = mutation({
  args: {
    slug: v.string(),
    participantDigest: v.string(),
    requestedByIpDigest: v.optional(v.string()),
    makeIdToReplace: v.optional(v.id("recipeMakes")),
  },
  handler: async (ctx, args) => {
    if (!isUploadEnabled()) {
      throw new Error("RECIPE_MAKE_UPLOAD_DISABLED");
    }

    const recipe = await requirePublishedRecipe(ctx, args.slug);
    await consumeRateLimits(ctx, args.participantDigest, args.requestedByIpDigest);

    if (await isBlocked(ctx, args.participantDigest)) {
      throw new Error("RECIPE_MAKE_PARTICIPANT_BLOCKED");
    }

    if (args.makeIdToReplace) {
      const make = await ctx.db.get(args.makeIdToReplace);
      if (!make || make.participantDigest !== args.participantDigest) {
        throw new Error("RECIPE_MAKE_OWNER_REQUIRED");
      }
      if (make.recipeId !== recipe._id) {
        throw new Error("RECIPE_MAKE_NOT_FOUND");
      }
    }

    const now = Date.now();
    const ticketDigest = `${now.toString(36)}.${crypto.randomUUID()}`;
    const ticketId = await ctx.db.insert("recipeMakeUploadTickets", {
      recipeId: recipe._id,
      participantDigest: args.participantDigest,
      ticketDigest,
      replaceMakeId: args.makeIdToReplace,
      requestedByIpDigest: args.requestedByIpDigest,
      createdAt: now,
      expiresAt: now + publicationWindow,
      reason: undefined,
    });

    return { ticketDigest };
  },
});

export const finalizeUpload = internalMutation({
  args: {
    slug: v.string(),
    participantDigest: v.string(),
    ticketDigest: v.string(),
    fullPhotoStorageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
    authorName: v.optional(v.string()),
    caption: v.optional(v.string()),
    altText: v.optional(v.string()),
    sourceStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const ticket = await getUploadTicket(ctx, args.ticketDigest, args.participantDigest);
    if (!ticket || ticket.participantDigest !== args.participantDigest) {
      throw new Error("RECIPE_MAKE_TICKET_INVALID");
    }
    if (ticket.redeemedAt) {
      throw new Error("RECIPE_MAKE_TICKET_REDEEMED");
    }
    if (ticket.expiresAt < Date.now()) {
      await ctx.db.delete(ticket._id);
      throw new Error("RECIPE_MAKE_TICKET_EXPIRED");
    }

    const recipe = await requirePublishedRecipe(ctx, args.slug);
    if (recipe._id !== ticket.recipeId) {
      throw new Error("RECIPE_MAKE_NOT_FOUND");
    }

    const now = Date.now();

    if (ticket.replaceMakeId) {
      const make = await ctx.db.get(ticket.replaceMakeId);
      if (!make || make.participantDigest !== args.participantDigest || make.recipeId !== recipe._id) {
        throw new Error("RECIPE_MAKE_OWNER_REQUIRED");
      }

      const previousFullPhotoStorageId = make.fullPhotoStorageId;
      const previousThumbnailStorageId = make.thumbnailStorageId;
      await ctx.db.patch(make._id, {
        fullPhotoStorageId: args.fullPhotoStorageId,
        thumbnailStorageId: args.thumbnailStorageId,
        authorName: normalizeOptionalText(args.authorName, 120),
        caption: normalizeOptionalText(args.caption, 500),
        altText: normalizeOptionalText(args.altText, 500),
        editedAt: now,
        updatedAt: now,
        state: "published",
        publishedAt: make.publishedAt ?? now,
      });

      if (previousFullPhotoStorageId && previousFullPhotoStorageId !== args.fullPhotoStorageId) {
        await ctx.storage.delete(previousFullPhotoStorageId).catch(() => undefined);
      }
      if (previousThumbnailStorageId && previousThumbnailStorageId !== args.thumbnailStorageId) {
        await ctx.storage.delete(previousThumbnailStorageId).catch(() => undefined);
      }
    } else {
      const makeId = await ctx.db.insert("recipeMakes", {
        recipeId: recipe._id,
        participantDigest: args.participantDigest,
        fullPhotoStorageId: args.fullPhotoStorageId,
        thumbnailStorageId: args.thumbnailStorageId,
        authorName: normalizeOptionalText(args.authorName, 120),
        caption: normalizeOptionalText(args.caption, 500),
        altText: normalizeOptionalText(args.altText, 500),
        state: "published",
        publishedAt: now,
        updatedAt: now,
      });
      await upsertMakeSummary(ctx, recipe._id, 1);
      await ctx.db.insert("recipeMakeBravoSummaries", { makeId, bravoCount: 0 });
      await ctx.db.insert("recipeMakeReportSummaries", {
        makeId,
        openReportCount: 0,
        totalReportCount: 0,
      });
    }

    await ctx.db.patch(ticket._id, {
      redeemedAt: now,
      sourceStorageId: args.sourceStorageId,
      fullPhotoStorageId: args.fullPhotoStorageId,
      thumbnailStorageId: args.thumbnailStorageId,
    });

    if (args.sourceStorageId) {
      await ctx.storage.delete(args.sourceStorageId).catch(() => undefined);
    }

    return { ok: true };
  },
});

export const update = mutation({
  args: {
    makeId: v.id("recipeMakes"),
    participantDigest: v.string(),
    authorName: v.optional(v.string()),
    caption: v.optional(v.string()),
    altText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const make = await requireOwnedMake(ctx, args.makeId, args.participantDigest);
    if (make.state !== "published") {
      throw new Error("RECIPE_MAKE_NOT_EDITABLE");
    }

    if (await isBlocked(ctx, args.participantDigest)) {
      throw new Error("RECIPE_MAKE_PARTICIPANT_BLOCKED");
    }

    await ctx.db.patch(make._id, {
      authorName: normalizeOptionalText(args.authorName, 120),
      caption: normalizeOptionalText(args.caption, 500),
      altText: normalizeOptionalText(args.altText, 500),
      updatedAt: Date.now(),
      editedAt: Date.now(),
    });

    return { makeId: make._id };
  },
});

export const removeOwn = mutation({
  args: {
    makeId: v.id("recipeMakes"),
    participantDigest: v.string(),
  },
  handler: async (ctx, args) => {
    const make = await requireOwnedMake(ctx, args.makeId, args.participantDigest);
    if (await isBlocked(ctx, args.participantDigest)) {
      throw new Error("RECIPE_MAKE_PARTICIPANT_BLOCKED");
    }

    await removeMake(ctx, make, true);
    return { makeId: make._id };
  },
});

export const toggleBravo = mutation({
  args: {
    makeId: v.id("recipeMakes"),
    participantDigest: v.string(),
  },
  handler: async (ctx, args) => {
    const make = await ctx.db.get(args.makeId);
    if (!make || make.state !== "published") {
      throw new Error("RECIPE_MAKE_NOT_FOUND");
    }

    if (await isBlocked(ctx, args.participantDigest)) {
      throw new Error("RECIPE_MAKE_PARTICIPANT_BLOCKED");
    }

    const existing = await ctx.db
      .query("recipeMakeBravos")
      .withIndex("by_makeId_and_participantDigest", (q) =>
        q.eq("makeId", make._id).eq("participantDigest", args.participantDigest),
      )
      .unique();

    const summary = await getMakeBravoSummary(ctx, make._id);
    let bravoCount = summary?.bravoCount ?? 0;
    let hasBravo = false;

    if (existing) {
      bravoCount -= 1;
      await ctx.db.delete(existing._id);
    } else {
      bravoCount += 1;
      await ctx.db.insert("recipeMakeBravos", {
        makeId: make._id,
        participantDigest: args.participantDigest,
        createdAt: Date.now(),
      });
      hasBravo = true;
    }

    await upsertBravoSummary(ctx, make._id, Math.max(0, bravoCount));
    return { makeId: make._id, bravoCount, hasBravo };
  },
});

export const report = mutation({
  args: {
    makeId: v.id("recipeMakes"),
    participantDigest: v.string(),
    reason: v.union(
      v.literal("spam"),
      v.literal("inappropriate"),
      v.literal("privacy"),
      v.literal("copyright"),
      v.literal("other"),
    ),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const make = await ctx.db.get(args.makeId);
    if (!make) throw new Error("RECIPE_MAKE_NOT_FOUND");

    if (await isBlocked(ctx, args.participantDigest)) {
      throw new Error("RECIPE_MAKE_PARTICIPANT_BLOCKED");
    }

    const existing = await ctx.db
      .query("recipeMakeReports")
      .withIndex("by_makeId_and_participantDigest", (q) =>
        q.eq("makeId", args.makeId).eq("participantDigest", args.participantDigest),
      )
      .unique();

    const normalizedDetails = normalizeOptionalText(args.details, 500);
    if (existing) {
      await ctx.db.patch(existing._id, {
        reason: args.reason,
        details: normalizedDetails,
        state: "open",
        createdAt: Date.now(),
      });
      return { reportId: existing._id };
    }

    await ctx.db.insert("recipeMakeReports", {
      makeId: args.makeId,
      participantDigest: args.participantDigest,
      reason: args.reason,
      details: normalizedDetails,
      createdAt: Date.now(),
      state: "open",
    });

    const summary = await getReportSummary(ctx, args.makeId);
    if (summary) {
      await upsertReportSummary(ctx, args.makeId, {
        openReportCount: summary.openReportCount + 1,
        totalReportCount: summary.totalReportCount + 1,
      });
    } else {
      await ctx.db.insert("recipeMakeReportSummaries", {
        makeId: args.makeId,
        openReportCount: 1,
        totalReportCount: 1,
      });
    }

    return { reportId: null };
  },
});

export const adminList = query({
  args: {
    recipeId: v.id("recipes"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("recipeMakes")
      .withIndex("by_recipeId", (q) => q.eq("recipeId", args.recipeId))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(result.page.map((make) => presentAdminMake(ctx, make))),
    };
  },
});

export const adminSetState = mutation({
  args: {
    makeId: v.id("recipeMakes"),
    state: v.union(v.literal("published"), v.literal("removed"), v.literal("blocked")),
    reason: v.optional(v.string()),
    participantDigest: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const make = await ctx.db.get(args.makeId);
    if (!make) throw new Error("RECIPE_MAKE_NOT_FOUND");

    if (args.state === "removed") {
      if (make.state === "published") {
        await upsertMakeSummary(ctx, make.recipeId, -1);
      }
      await ctx.db.patch(make._id, {
        state: "removed",
        removedAt: Date.now(),
        removedBy: "admin",
        removalReason: normalizeOptionalText(args.reason, 500),
        updatedAt: Date.now(),
      });
      return { makeId: make._id };
    }

    if (args.state === "published") {
      if (make.state !== "published") {
        await upsertMakeSummary(ctx, make.recipeId, 1);
      }
      await ctx.db.patch(make._id, {
        state: "published",
        removedAt: undefined,
        removedBy: undefined,
        removalReason: undefined,
        blockUntil: undefined,
        updatedAt: Date.now(),
      });
      return { makeId: make._id };
    }

    if (args.state === "blocked") {
      if (!args.participantDigest) {
        throw new Error("RECIPE_MAKE_PARTICIPANT_REQUIRED");
      }
      await ctx.db.insert("recipeMakeParticipantBlocks", {
        participantDigest: args.participantDigest,
        reason: normalizeOptionalText(args.reason, 500) ?? "manual moderation",
        createdAt: Date.now(),
        expiresAt: Date.now() + dayMs,
        canReact: false,
      });
      return { makeId: make._id };
    }

    return { makeId: make._id };
  },
});

export const adminCleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - makePurgeDelay;
    const candidates = await ctx.db
      .query("recipeMakes")
      .withIndex("by_state", (q) => q.eq("state", "removed"))
      .order("asc")
      .take(50);

    const expired = candidates.filter(
      (make): make is RecipeMake =>
        make.removedAt !== undefined && make.removedAt <= cutoff,
    );

    for (const make of expired) {
      await removeMake(ctx, make, true);
    }

    return { purged: expired.length };
  },
});

export const adminDismissReport = internalMutation({
  args: { reportId: v.id("recipeMakeReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return { reportId: null };

    if (report.state === "dismissed") {
      return { reportId: report._id };
    }

    await ctx.db.patch(report._id, { state: "dismissed" });
    const summary = await getReportSummary(ctx, report.makeId);
    if (summary && summary.openReportCount > 0) {
      await upsertReportSummary(ctx, report.makeId, {
        openReportCount: summary.openReportCount - 1,
        totalReportCount: summary.totalReportCount,
      });
    }

    return { reportId: report._id };
  },
});

async function presentMake(
  ctx: QueryCtx,
  make: RecipeMake,
  participantDigest: string | null,
): Promise<MakePresentation> {
  const [bravoSummary, reportSummary, viewerReport] = await Promise.all([
    ctx.db
      .query("recipeMakeBravoSummaries")
      .withIndex("by_makeId", (q) => q.eq("makeId", make._id))
      .unique(),
    ctx.db
      .query("recipeMakeReportSummaries")
      .withIndex("by_makeId", (q) => q.eq("makeId", make._id))
      .unique(),
    participantDigest
      ? ctx.db
          .query("recipeMakeReports")
          .withIndex("by_makeId_and_participantDigest", (q) =>
            q.eq("makeId", make._id).eq("participantDigest", participantDigest),
          )
          .unique()
      : Promise.resolve(null),
  ]);

  const [fullPhotoUrl, thumbnailUrl] = await Promise.all([
    ctx.storage.getUrl(make.fullPhotoStorageId),
    ctx.storage.getUrl(make.thumbnailStorageId),
  ]);

  const viewerHasBravo = participantDigest
    ? Boolean(
        await ctx.db
          .query("recipeMakeBravos")
          .withIndex("by_makeId_and_participantDigest", (q) =>
            q.eq("makeId", make._id).eq("participantDigest", participantDigest),
          )
          .unique(),
      )
    : false;

  return {
    _id: make._id,
    _creationTime: make._creationTime,
    authorName: make.authorName ?? null,
    caption: make.caption ?? null,
    altText: make.altText ?? null,
    fullPhotoUrl,
    thumbnailUrl,
    isAuthor: participantDigest !== null && make.participantDigest === participantDigest,
    viewerHasBravo,
    viewerHasReported: viewerReport !== null,
    bravoCount: bravoSummary?.bravoCount ?? 0,
    reportCount: reportSummary?.totalReportCount ?? 0,
    canEdit: participantDigest !== null && make.participantDigest === participantDigest,
    canReport: make.state === "published",
    edited: make.editedAt !== undefined,
  };
}

async function presentAdminMake(
  ctx: QueryCtx,
  make: RecipeMake,
): Promise<AdminMakePresentation> {
  const summary = await ctx.db
    .query("recipeMakeReportSummaries")
    .withIndex("by_makeId", (q) => q.eq("makeId", make._id))
    .unique();

  const [fullPhotoUrl, thumbnailUrl] = await Promise.all([
    ctx.storage.getUrl(make.fullPhotoStorageId),
    ctx.storage.getUrl(make.thumbnailStorageId),
  ]);

  return {
    _id: make._id,
    _creationTime: make._creationTime,
    authorName: make.authorName ?? null,
    caption: make.caption ?? null,
    altText: make.altText ?? null,
    fullPhotoUrl,
    thumbnailUrl,
    reportCount: summary?.totalReportCount ?? 0,
    state: make.state,
  };
}

async function getRecipeBySlug(ctx: QueryCtx | MutationCtx, slug: string) {
  return ctx.db
    .query("recipes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

async function requirePublishedRecipe(ctx: MutationCtx, slug: string) {
  const recipe = await getRecipeBySlug(ctx, slug);
  if (!recipe || recipe.status !== "published") {
    throw new Error("RECIPE_NOT_PUBLIC");
  }
  return recipe;
}

async function getMakeSummary(ctx: QueryCtx | MutationCtx, recipeId: Id<"recipes">) {
  return ctx.db
    .query("recipeMakeSummaries")
    .withIndex("by_recipeId", (q) => q.eq("recipeId", recipeId))
    .unique();
}

async function upsertMakeSummary(ctx: MutationCtx, recipeId: Id<"recipes">, delta: 1 | -1) {
  const summary = await getMakeSummary(ctx, recipeId);
  if (!summary) {
    if (delta > 0) {
      await ctx.db.insert("recipeMakeSummaries", { recipeId, makeCount: 1 });
    }
    return;
  }

  const nextCount = summary.makeCount + delta;
  if (nextCount <= 0) {
    await ctx.db.delete(summary._id);
    return;
  }

  await ctx.db.patch(summary._id, { makeCount: nextCount });
}

async function getUploadTicket(ctx: QueryCtx | MutationCtx, ticketDigest: string, participantDigest: string) {
  const ticket = await ctx.db
    .query("recipeMakeUploadTickets")
    .withIndex("by_ticketDigest", (q) => q.eq("ticketDigest", ticketDigest))
    .unique();
  if (!ticket || ticket.participantDigest !== participantDigest) {
    throw new Error("RECIPE_MAKE_TICKET_INVALID");
  }
  return ticket;
}

async function getMakeBravoSummary(ctx: QueryCtx | MutationCtx, makeId: Id<"recipeMakes">) {
  return ctx.db
    .query("recipeMakeBravoSummaries")
    .withIndex("by_makeId", (q) => q.eq("makeId", makeId))
    .unique();
}

async function upsertBravoSummary(
  ctx: MutationCtx,
  makeId: Id<"recipeMakes">,
  bravoCount: number,
) {
  const summary = await getMakeBravoSummary(ctx, makeId);
  if (!summary) {
    await ctx.db.insert("recipeMakeBravoSummaries", { makeId, bravoCount: Math.max(0, bravoCount) });
    return;
  }
  await ctx.db.patch(summary._id, { bravoCount: Math.max(0, bravoCount) });
}

async function getReportSummary(ctx: QueryCtx | MutationCtx, makeId: Id<"recipeMakes">) {
  return ctx.db
    .query("recipeMakeReportSummaries")
    .withIndex("by_makeId", (q) => q.eq("makeId", makeId))
    .unique();
}

async function upsertReportSummary(
  ctx: MutationCtx,
  makeId: Id<"recipeMakes">,
  data: { openReportCount: number; totalReportCount: number },
) {
  const summary = await getReportSummary(ctx, makeId);
  if (!summary) {
    await ctx.db.insert("recipeMakeReportSummaries", {
      makeId,
      openReportCount: Math.max(0, data.openReportCount),
      totalReportCount: Math.max(0, data.totalReportCount),
    });
    return;
  }

  await ctx.db.patch(summary._id, {
    openReportCount: Math.max(0, data.openReportCount),
    totalReportCount: Math.max(0, data.totalReportCount),
  });
}

async function requireOwnedMake(
  ctx: MutationCtx,
  makeId: Id<"recipeMakes">,
  participantDigest: string,
) {
  const make = await ctx.db.get(makeId);
  if (!make) throw new Error("RECIPE_MAKE_NOT_FOUND");
  if (make.participantDigest !== participantDigest) {
    throw new Error("RECIPE_MAKE_OWNER_REQUIRED");
  }
  return make;
}

async function isBlocked(ctx: QueryCtx | MutationCtx, participantDigest: string) {
  const block = await ctx.db
    .query("recipeMakeParticipantBlocks")
    .withIndex("by_participantDigest", (q) => q.eq("participantDigest", participantDigest))
    .unique();
  return Boolean(block && block.expiresAt > Date.now());
}

async function consumeRateLimits(
  ctx: MutationCtx,
  participantDigest: string,
  requestedByIpDigest?: string,
) {
  await consumeRateWindow(
    ctx,
    "recipeMakeRateLimits",
    { participantDigest },
    participantDigest,
    maxPublicationAttemptsPerHour,
    hourMs,
  );

  if (requestedByIpDigest) {
    await consumeRateWindow(
      ctx,
      "recipeMakeNetworkRateLimits",
      { networkDigest: requestedByIpDigest },
      requestedByIpDigest,
      maxPublicationAttemptsPerDay,
      dayMs,
    );
  }
}

async function consumeRateWindow(
  ctx: MutationCtx,
  tableName: "recipeMakeRateLimits" | "recipeMakeNetworkRateLimits",
  _match: { participantDigest: string } | { networkDigest: string },
  key: string,
  maximum: number,
  windowMs: number,
) {
  const now = Date.now();
  if (tableName === "recipeMakeRateLimits") {
    const current = await ctx.db
      .query("recipeMakeRateLimits")
      .withIndex("by_participantDigest", (q) => q.eq("participantDigest", key))
      .unique();

    if (!current || current.windowStartedAt + windowMs <= now) {
      if (current) {
        await ctx.db.patch(current._id, { windowStartedAt: now, count: 1 });
      } else {
        await ctx.db.insert("recipeMakeRateLimits", {
          participantDigest: key,
          windowStartedAt: now,
          count: 1,
        });
      }
      return;
    }

    if (current.count >= maximum) {
      throw new Error("RECIPE_MAKE_RATE_LIMITED");
    }
    await ctx.db.patch(current._id, { count: current.count + 1 });
    return;
  }

  const current = await ctx.db
    .query("recipeMakeNetworkRateLimits")
    .withIndex("by_networkDigest", (q) => q.eq("networkDigest", key))
    .unique();

  if (!current || current.windowStartedAt + windowMs <= now) {
    if (current) {
      await ctx.db.patch(current._id, { windowStartedAt: now, count: 1 });
    } else {
      await ctx.db.insert("recipeMakeNetworkRateLimits", {
        networkDigest: key,
        windowStartedAt: now,
        count: 1,
      });
    }
    return;
  }

  if (current.count >= maximum) {
    throw new Error("RECIPE_MAKE_RATE_LIMITED");
  }
  await ctx.db.patch(current._id, { count: current.count + 1 });
}

async function removeMake(ctx: MutationCtx, make: RecipeMake, purgeFiles: boolean) {
  if (make.state === "published") {
    await upsertMakeSummary(ctx, make.recipeId, -1);
  }

  if (purgeFiles) {
    await Promise.all([
      ctx.storage.delete(make.fullPhotoStorageId).catch(() => undefined),
      ctx.storage.delete(make.thumbnailStorageId).catch(() => undefined),
    ]);
  }

  await clearMakeChildren(ctx, make._id);
  await ctx.db.delete(make._id);
}

async function clearMakeChildren(ctx: MutationCtx, makeId: Id<"recipeMakes">) {
  const bravos = await ctx.db
    .query("recipeMakeBravos")
    .withIndex("by_makeId", (q) => q.eq("makeId", makeId))
    .take(200);
  for (const bravo of bravos) {
    await ctx.db.delete(bravo._id);
  }

  const reports = await ctx.db
    .query("recipeMakeReports")
    .withIndex("by_makeId", (q) => q.eq("makeId", makeId))
    .take(200);
  for (const report of reports) {
    await ctx.db.delete(report._id);
  }

  const summary = await getReportSummary(ctx, makeId);
  if (summary) {
    await ctx.db.delete(summary._id);
  }
  const bravoSummary = await getMakeBravoSummary(ctx, makeId);
  if (bravoSummary) {
    await ctx.db.delete(bravoSummary._id);
  }
}

function normalizeOptionalText(value: string | undefined, maxLength: number) {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function isUploadEnabled() {
  const value = process.env.RECIPE_MAKE_UPLOAD_ENABLED;
  return value !== "false";
}

declare const process: {
  env: {
    RECIPE_MAKE_UPLOAD_ENABLED?: string;
    RECIPE_MAKE_UPLOAD_ORIGIN?: string;
  };
};

export const _types = {
  finalizeUpload,
  adminCleanupExpired,
  adminDismissReport,
};
