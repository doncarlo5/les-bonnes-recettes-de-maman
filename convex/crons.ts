import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "remove unreferenced comment uploads",
  "20 3 * * *",
  internal.comments.cleanupUnreferencedStorage,
  {},
);

crons.cron(
  "remove expired comment rate limits",
  "35 3 * * *",
  internal.comments.cleanupExpiredRateLimits,
  {},
);

export default crons;
