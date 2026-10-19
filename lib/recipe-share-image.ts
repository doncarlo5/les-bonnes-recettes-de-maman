import posters from "@/assets/recipe-posters/share-images.json";

/** Sharing artwork is independent of the photograph displayed on the recipe. */
export function getRecipeShareImageUrl(slug: string, photoUrl: string) {
  return (posters as Record<string, string>)[slug] || photoUrl;
}
