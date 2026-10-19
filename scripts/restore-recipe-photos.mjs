import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import assert from "node:assert/strict";
const originals = JSON.parse(await readFile("assets/recipe-posters/original-images.json", "utf8"));
const client = new ConvexHttpClient(process.env.CONVEX_PRODUCTION_URL);
const get = slug => client.query(makeFunctionReference("recipes:getForEditing"), { slug, locale: "fr", adminPassword: process.env.RECIPE_ADMIN_PASSWORD });
const log = [];
for (const original of originals) {
  const before = await get(original.slug);
  if (before.heroImageUrl === original.url) { console.log(`${original.slug}: already restored`); continue; }
  assert(before.isPublic && !before.hasUnpublishedChanges, `${original.slug}: unpublished edits`);
  assert.equal(before.heroImageUrl, original.expectedImageUrl);
  execFileSync("npx", ["convex", "run", "restoreRecipeImages:restore", JSON.stringify({ slug: original.slug, expectedRevision: before.revision }), "--prod", "--codegen", "disable"], { stdio: "pipe" });
  const after = await get(original.slug);
  for (const field of ["translations", "categories", "referenceServings", "relatedRecipeSlugs", "defaultLocale"]) assert.deepEqual(after[field], before[field]);
  assert.equal(after.heroImageUrl, original.url);
  assert.deepEqual(after.imageCredit ?? null, original.credit);
  assert.equal(after.hasUnpublishedChanges, false);
  log.push({ slug: original.slug, restored: true, revision: after.revision });
  await writeFile("assets/recipe-posters/photo-restoration.json", JSON.stringify(log, null, 2) + "\n");
  console.log(`${original.slug}: restored, content and credits verified`);
}
