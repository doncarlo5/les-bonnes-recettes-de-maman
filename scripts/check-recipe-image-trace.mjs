import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Recipe metadata imports Sharp. Its matching libvips binary must travel with
// the page function, even when Next.js also installs another Sharp version.
const tracePath = ".next/server/app/[locale]/(public)/recettes/[slug]/page.js.nft.json";
const trace = JSON.parse(await readFile(tracePath, "utf8"));
const included = new Set(trace.files.map((file) => resolve(dirname(tracePath), file)));
const libDir = `node_modules/@img/sharp-libvips-${process.platform}-${process.arch}/lib`;
const binaries = (await readdir(libDir)).filter((name) => name.startsWith("libvips-cpp") && !name.endsWith(".js"));
assert(binaries.length > 0, "The app's native image library is not installed");
for (const binary of binaries) {
  assert(included.has(resolve(libDir, binary)), `Recipe server bundle is missing ${libDir}/${binary}`);
}
console.log("Recipe image converter's native library is included in the server bundle.");
