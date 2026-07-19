import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function presentComment(
  ctx: QueryCtx,
  comment: Doc<"recipeComments">,
  participantDigest: string | null,
) {
  const [summary, reaction, photoUrl] = await Promise.all([
    ctx.db.query("commentReactionSummaries").withIndex("by_commentId", (q) => q.eq("commentId", comment._id)).unique(),
    participantDigest
      ? ctx.db.query("commentReactions").withIndex("by_commentId_and_participantDigest", (q) => q.eq("commentId", comment._id).eq("participantDigest", participantDigest)).unique()
      : Promise.resolve(null),
    comment.photoStorageId ? ctx.storage.getUrl(comment.photoStorageId) : Promise.resolve(null),
  ]);
  return {
    _id: comment._id,
    _creationTime: comment._creationTime,
    authorName: comment.authorName ?? null,
    text: comment.text,
    photoUrl,
    updatedAt: comment.updatedAt ?? null,
    edited: comment.updatedAt !== undefined,
    thumbsUpCount: summary?.thumbsUpCount ?? 0,
    thumbsDownCount: summary?.thumbsDownCount ?? 0,
    viewerReaction: reaction?.direction ?? null,
    canEdit: participantDigest !== null && comment.ownerDigest === participantDigest,
  };
}

export async function removeComment(ctx: MutationCtx, comment: Doc<"recipeComments">) {
  if (comment.photoStorageId) await ctx.storage.delete(comment.photoStorageId);
  const summary = await ctx.db.query("commentReactionSummaries").withIndex("by_commentId", (q) => q.eq("commentId", comment._id)).unique();
  if (summary) await ctx.db.delete(summary._id);
  await ctx.db.delete(comment._id);
  await ctx.scheduler.runAfter(0, internal.commentMaintenance.cleanupReactions, { commentId: comment._id });
}
