import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const hourMs = 60 * 60 * 1000;

export const cleanupExpiredRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("recipeIdeaRateLimits")
      .withIndex("by_windowStartedAt", (q) =>
        q.lt("windowStartedAt", Date.now() - hourMs),
      )
      .take(100);
    for (const window of expired) await ctx.db.delete(window._id);
    if (expired.length === 100) {
      await ctx.scheduler.runAfter(
        0,
        internal.recipeIdeaMaintenance.cleanupExpiredRateLimits,
        {},
      );
    }
    return null;
  },
});
