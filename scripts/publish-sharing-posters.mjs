import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import sharp from "sharp";

// Upload sharing artwork only. Never call setHeroImage or publish a recipe.
const client = new ConvexHttpClient(process.env.CONVEX_PRODUCTION_URL);
const password = process.env.RECIPE_ADMIN_PASSWORD;
const entries = JSON.parse(await readFile("assets/recipe-posters/proposal-2/generated-all.json", "utf8"));
const mappingPath = "assets/recipe-posters/share-images.json";
const journalPath = "assets/recipe-posters/proposal-2/sharing-publication.json";
const mapping = JSON.parse(await readFile(mappingPath, "utf8"));
const manifest = JSON.parse(await readFile("assets/recipe-posters/manifest.json", "utf8"));
let journal = {};
try { journal = JSON.parse(await readFile(journalPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for (const { slug } of entries) {
  const file = `/images/recipes/posters/${slug}-fr-v2.webp`;
  const bytes = await readFile(`public${file}`);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
  const before = await client.query(makeFunctionReference("recipes:getBySlug"), { slug, locale: "fr" });
  assert(before, `Missing published recipe: ${slug}`);
  if (journal[slug]) assert.equal(journal[slug].hash, hash(bytes), `Changed uploaded asset: ${slug}`);
  else {
    const upload = await client.mutation(makeFunctionReference("recipes:generateUploadUrl"), { adminPassword: password });
    const response = await fetch(upload, { method: "POST", headers: { "Content-Type": "image/webp" }, body: bytes });
    assert(response.ok, `Upload failed: ${slug}`);
    const { storageId } = await response.json();
    assert(storageId);
    journal[slug] = { storageId, hash: hash(bytes), previousImageUrl: mapping[slug], file };
    await writeFile(journalPath, JSON.stringify(journal, null, 2) + "\n");
  }
  journal[slug].imageUrl = JSON.parse(execFileSync("npx", ["convex", "run", "sharingPosterAssets:getUrl", JSON.stringify({ storageId: journal[slug].storageId }), "--prod", "--codegen", "disable"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  assert(journal[slug].imageUrl, `Missing storage URL: ${slug}`);
  await writeFile(journalPath, JSON.stringify(journal, null, 2) + "\n");
  const image = await fetch(journal[slug].imageUrl);
  assert(image.ok, `Stored image unavailable: ${slug} (${image.status})`);
  assert.equal(hash(Buffer.from(await image.arrayBuffer())), hash(bytes));
  const after = await client.query(makeFunctionReference("recipes:getBySlug"), { slug, locale: "fr" });
  assert.deepEqual(after, before, `Recipe changed during upload: ${slug}`);
  mapping[slug] = journal[slug].imageUrl;
  manifest.find(entry => entry.slug === slug).file = file;
  await writeFile(mappingPath, JSON.stringify(mapping, null, 2) + "\n");
  await writeFile("assets/recipe-posters/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${slug}: sharing poster uploaded; recipe unchanged`);
}
