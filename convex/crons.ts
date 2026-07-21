import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "remove unreferenced comment uploads",
  "20 3 * * *",
  internal.commentMaintenance.cleanupUnreferencedStorage,
  {},
);

crons.cron(
  "remove expired comment rate limits",
  "35 3 * * *",
  internal.commentMaintenance.cleanupExpiredRateLimits,
  {},
);

crons.cron(
  "remove expired recipe idea rate limits",
  "45 3 * * *",
  internal.recipeIdeaMaintenance.cleanupExpiredRateLimits,
  {},
);

export default crons;
