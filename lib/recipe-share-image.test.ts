import { expect, test } from "vitest";
import { getRecipeShareImageUrl } from "./recipe-share-image";
import originals from "@/assets/recipe-posters/original-images.json";
import proposal2 from "@/assets/recipe-posters/proposal-2/sharing-publication.json";

test("all restored recipes retain their AI sharing poster independently of the cover photograph", () => {
  expect(originals).toHaveLength(40);
  for (const entry of originals) {
    const replacement = (proposal2 as Record<string, { imageUrl: string }>)[entry.slug];
    expect(getRecipeShareImageUrl(entry.slug, entry.url)).toBe(replacement?.imageUrl ?? entry.expectedImageUrl);
    expect(getRecipeShareImageUrl(entry.slug, entry.url)).not.toBe(entry.url);
  }
});
test("recipes without separate artwork fall back to their photograph", () => {
  expect(getRecipeShareImageUrl("new-recipe", "/photo.jpg")).toBe("/photo.jpg");
});
