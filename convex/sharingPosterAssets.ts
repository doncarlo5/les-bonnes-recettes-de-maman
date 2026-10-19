import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/** Resolve uploaded artwork without associating it with a recipe's cover. */
export const getUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});
