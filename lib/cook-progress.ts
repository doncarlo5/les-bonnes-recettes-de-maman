import type { Ingredient, RecipeSection, SubRecipe } from "@/components/recipes/types";

export type CookProgressV1 = {
  version: 1;
  contentSignature: string;
  sectionIndex: number;
  stepIndex: number;
  checkedIngredientIds: string[];
  updatedAt: number;
};

export type CookableContent = {
  ingredients: Ingredient[];
  sections: RecipeSection[];
  subRecipes: SubRecipe[];
};

export function getCookProgressKey(locale: string, slug: string) {
  return `recipe-cook:v1:${locale}:${slug}`;
}

export function createCookContentSignature(content: CookableContent) {
  const serialized = JSON.stringify({
    ingredients: content.ingredients,
    sections: content.sections,
    subRecipes: content.subRecipes,
  });
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function parseCookProgress(
  serialized: string | null,
  content: CookableContent,
): CookProgressV1 | null {
  if (!serialized) return null;

  try {
    const value = JSON.parse(serialized) as Partial<CookProgressV1>;
    if (
      value.version !== 1 ||
      value.contentSignature !== createCookContentSignature(content) ||
      !Number.isInteger(value.sectionIndex) ||
      !Number.isInteger(value.stepIndex) ||
      typeof value.updatedAt !== "number" ||
      !Array.isArray(value.checkedIngredientIds)
    ) {
      return null;
    }

    const section = content.sections[value.sectionIndex as number];
    if (!section || !section.steps[value.stepIndex as number]) return null;

    const validIngredientIds = new Set([
      ...content.ingredients.map((_, index) => `main:${index}`),
      ...content.subRecipes.flatMap((subRecipe, subRecipeIndex) =>
        subRecipe.ingredients.map(
          (_, ingredientIndex) => `sub:${subRecipeIndex}:${ingredientIndex}`,
        ),
      ),
    ]);

    return {
      version: 1,
      contentSignature: value.contentSignature,
      sectionIndex: value.sectionIndex as number,
      stepIndex: value.stepIndex as number,
      checkedIngredientIds: value.checkedIngredientIds.filter(
        (id): id is string => typeof id === "string" && validIngredientIds.has(id),
      ),
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}
