import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const adminPassword = process.env.RECIPE_ADMIN_PASSWORD;
if (!adminPassword) {
  throw new Error("RECIPE_ADMIN_PASSWORD is required to synchronize recipes.");
}

const productionUrl =
  process.env.CONVEX_PRODUCTION_URL ??
  (process.env.VERCEL_ENV === "production"
    ? process.env.NEXT_PUBLIC_CONVEX_URL
    : undefined);
if (!productionUrl) {
  throw new Error(
    "CONVEX_PRODUCTION_URL is required to synchronize production recipes.",
  );
}

const client = new ConvexHttpClient(productionUrl);
const syncProduction = makeFunctionReference("recipes:syncProduction");
const result = await client.mutation(syncProduction, {
  adminPassword,
});
console.log(JSON.stringify(result, null, 2));
