import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, rename } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import sharp from "sharp";

const [target, ...extra] = process.argv.slice(2);
if (!target || extra.some((arg) => arg !== "--apply")) {
  throw new Error("Usage: node --env-file=.env.local scripts/publish-recipe-posters.mjs <slug|--all> [--apply]");
}
const apply = extra.includes("--apply");
const url = process.env.CONVEX_PRODUCTION_URL;
const adminPassword = process.env.RECIPE_ADMIN_PASSWORD;
if (!url || !adminPassword) throw new Error("CONVEX_PRODUCTION_URL and RECIPE_ADMIN_PASSWORD are required.");
const client = new ConvexHttpClient(url);
const query = (name, args) => client.query(makeFunctionReference(`recipes:${name}`), args);
const mutate = (name, args) => client.mutation(makeFunctionReference(`recipes:${name}`), { ...args, adminPassword });
const manifest = JSON.parse(await readFile("assets/recipe-posters/manifest.json", "utf8"));
const entries = manifest.filter((entry) => target === "--all" || entry.slug === target);
if (!entries.length) throw new Error("No matching poster.");
const journalPath = "assets/recipe-posters/publication.json";
let journal;
try {
  journal = JSON.parse(await readFile(journalPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  journal = { deployment: url, recipes: {} };
}
if (journal.deployment !== url) throw new Error("Publication journal belongs to another deployment.");
async function checkpoint() {
  await writeFile(`${journalPath}.tmp`, `${JSON.stringify(journal, null, 2)}\n`);
  await rename(`${journalPath}.tmp`, journalPath);
}

for (const entry of entries) {
  const { slug, file } = entry;
  const bytes = await readFile(`public${file}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== "webp" || Math.abs(metadata.width / metadata.height - 9 / 16) > 0.01) {
    throw new Error(`${slug}: expected a 9:16 WebP poster.`);
  }
  const recipe = await query("getForEditing", { slug, locale: "fr", adminPassword });
  if (!recipe || !recipe.isPublic) throw new Error(`${slug}: recipe is not published.`);
  const previous = journal.recipes[slug];
  if (previous && previous.hash !== hash) throw new Error(`${slug}: asset changed after publication started; review the journal.`);
  if (previous?.stage === "published") {
    if (recipe.heroImageUrl !== previous.imageUrl) throw new Error(`${slug}: image has changed since publication.`);
    console.log(`${slug}: already published`);
    continue;
  }
  // Resume only our own image revision; never publish someone else's pending edits.
  const resuming = previous?.imageUrl === recipe.heroImageUrl && previous?.revision === recipe.revision;
  if (recipe.hasUnpublishedChanges && !resuming) throw new Error(`${slug}: has unrelated unpublished changes.`);
  if (!apply) {
    console.log(`${slug}: ready (${Math.round(bytes.length / 1024)} KB)`);
    continue;
  }
  const record = previous ?? {
    hash,
    previousImageUrl: recipe.heroImageUrl,
    previousImageCredit: recipe.imageCredit ?? null,
    previousRevision: recipe.revision,
    stage: "prepared",
  };
  journal.recipes[slug] = record;
  await checkpoint();
  if (!record.storageId) {
    const uploadUrl = await mutate("generateUploadUrl", {});
    const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/webp" }, body: bytes });
    if (!response.ok) throw new Error(`${slug}: upload failed (${response.status}).`);
    record.storageId = (await response.json()).storageId;
    if (!record.storageId) throw new Error(`${slug}: upload returned no storage ID.`);
    await checkpoint();
  }
  if (!resuming) {
    if (recipe.revision !== record.previousRevision) throw new Error(`${slug}: revision changed; review before resuming.`);
    const saved = await mutate("setHeroImage", { slug, storageId: record.storageId, expectedRevision: recipe.revision });
    record.imageUrl = saved.heroImageUrl;
    record.revision = saved.revision;
    record.stage = "saved";
    await checkpoint();
  }
  if (recipe.hasUnpublishedChanges || !resuming) {
    execFileSync("npx", ["convex", "run", "recipes:publishImageOnly", JSON.stringify({ slug, expectedRevision: record.revision }), "--prod", "--codegen", "disable"], { stdio: "pipe" });
  }
  const published = await query("getBySlug", { slug, locale: "fr" });
  if (published?.heroImageUrl !== record.imageUrl) throw new Error(`${slug}: published image verification failed.`);
  record.stage = "published";
  await checkpoint();
  console.log(`${slug}: published and verified`);
}
