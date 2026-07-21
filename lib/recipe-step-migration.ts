import { legacyIngredientId, legacyStepId } from "./recipe-item-ids";

type LegacyIngredient = {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

type LegacySection = {
  title: string;
  steps: string[];
  stepDetails?: Array<{
    id: string;
    text: string;
    ingredientUses: Array<{
      ingredientId: string;
      amount?: { quantity: string; unit: string };
    }>;
  }>;
};

type LegacyLocalized = {
  ingredients: LegacyIngredient[];
  sections: LegacySection[];
  subRecipes: Array<{ title: string; ingredients: LegacyIngredient[] }>;
};

export function backfillLocalizedStepIngredients<T extends LegacyLocalized>(localized: T): T & LegacyLocalized {
  const complete =
    localized.ingredients.every((ingredient) => ingredient.id) &&
    localized.subRecipes.every((subRecipe) =>
      subRecipe.ingredients.every((ingredient) => ingredient.id),
    ) &&
    localized.sections.every((section) => section.stepDetails);
  if (complete) return localized;

  return {
    ...localized,
    ingredients: localized.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: ingredient.id ?? legacyIngredientId("main", index),
    })),
    sections: localized.sections.map((section, sectionIndex) => ({
      ...section,
      stepDetails: section.stepDetails ?? section.steps.map((text, stepIndex) => ({
        id: legacyStepId(sectionIndex, stepIndex),
        text,
        ingredientUses: [],
      })),
    })),
    subRecipes: localized.subRecipes.map((subRecipe, subRecipeIndex) => ({
      ...subRecipe,
      ingredients: subRecipe.ingredients.map((ingredient, index) => ({
        ...ingredient,
        id: ingredient.id ?? legacyIngredientId(`sub-${subRecipeIndex}`, index),
      })),
    })),
  } as T;
}
