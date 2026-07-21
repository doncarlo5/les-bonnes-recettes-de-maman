import type {
  Ingredient,
  Recipe,
  RecipeSection,
  RecipeStep,
  SubRecipe,
} from "@/components/recipes/types";
import { legacyIngredientId, legacyStepId } from "@/lib/recipe-item-ids";

type PublicIngredient = Omit<Ingredient, "id"> & { id?: string };
type PublicSection = {
  title: string;
  steps: string[] | RecipeStep[];
  stepDetails?: RecipeStep[];
};

export type PublicRecipeWire = Omit<
  Recipe,
  "ingredients" | "sections" | "subRecipes" | "equipment" | "restTime"
> & {
  ingredients: PublicIngredient[];
  sections: PublicSection[];
  subRecipes: Array<
    Omit<SubRecipe, "ingredients"> & { ingredients: PublicIngredient[] }
  >;
  equipment?: string[];
  restTime?: string;
};

/**
 * Converts both rollout-1's additive wire format and the historical public
 * response into the single structured model consumed by the UI.
 */
export function normalizeRecipeForDisplay(recipe: PublicRecipeWire): Recipe {
  return {
    ...recipe,
    restTime: recipe.restTime ?? "",
    equipment: recipe.equipment ?? [],
    ingredients: recipe.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: ingredient.id ?? legacyIngredientId("main", index),
    })),
    subRecipes: recipe.subRecipes.map((subRecipe, subRecipeIndex) => ({
      ...subRecipe,
      ingredients: subRecipe.ingredients.map((ingredient, ingredientIndex) => ({
        ...ingredient,
        id:
          ingredient.id ??
          legacyIngredientId(`sub-${subRecipeIndex}`, ingredientIndex),
      })),
    })),
    sections: recipe.sections.map((section, sectionIndex): RecipeSection => {
      const structuredSteps =
        section.stepDetails ??
        (typeof section.steps[0] === "object"
          ? (section.steps as RecipeStep[])
          : undefined);
      return {
        title: section.title,
        steps:
          structuredSteps ??
          (section.steps as string[]).map((text, stepIndex) => ({
            id: legacyStepId(sectionIndex, stepIndex),
            text,
            ingredientUses: [],
          })),
      };
    }),
  };
}
