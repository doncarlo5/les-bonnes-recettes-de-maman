import type { RecipeSection } from "@/components/recipes/types";

export function countIngredientReferences(
  sections: RecipeSection[],
  ingredientIds: string[],
) {
  const ids = new Set(ingredientIds);
  return sections.reduce(
    (total, section) =>
      total +
      section.steps.filter((step) =>
        step.ingredientUses.some((use) => ids.has(use.ingredientId)),
      ).length,
    0,
  );
}

export function removeIngredientReferences(
  sections: RecipeSection[],
  ingredientIds: string[],
) {
  const ids = new Set(ingredientIds);
  return sections.map((section) => ({
    ...section,
    steps: section.steps.map((step) => ({
      ...step,
      ingredientUses: step.ingredientUses.filter(
        (use) => !ids.has(use.ingredientId),
      ),
    })),
  }));
}
