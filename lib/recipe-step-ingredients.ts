import type {
  Ingredient,
  StepIngredientUse,
  SubRecipe,
} from "@/components/recipes/types";
import { formatScaledIngredient } from "./recipe-servings";
import type { RecipeLocale } from "./recipe-servings";

type IngredientSource = {
  ingredients: Ingredient[];
  subRecipes: SubRecipe[];
};

export type ResolvedStepIngredient = {
  id: string;
  name: string;
  amount: string;
  groupTitle?: string;
};

export function resolveStepIngredients(
  source: IngredientSource,
  uses: StepIngredientUse[],
  factor: number,
  locale: RecipeLocale,
) {
  const ingredients = new Map<
    string,
    { ingredient: Ingredient; groupTitle?: string }
  >();
  for (const ingredient of source.ingredients) {
    if (ingredient.id) ingredients.set(ingredient.id, { ingredient });
  }
  for (const subRecipe of source.subRecipes) {
    for (const ingredient of subRecipe.ingredients) {
      if (ingredient.id) {
        ingredients.set(ingredient.id, {
          ingredient,
          groupTitle: subRecipe.title,
        });
      }
    }
  }

  return uses.flatMap((use): ResolvedStepIngredient[] => {
    const match = ingredients.get(use.ingredientId);
    if (!match) return [];
    const amountSource = use.amount && (use.amount.quantity || use.amount.unit)
      ? use.amount
      : match.ingredient;
    return [
      {
        id: use.ingredientId,
        name: match.ingredient.name,
        amount: formatScaledIngredient(amountSource, factor, locale),
        groupTitle: match.groupTitle,
      },
    ];
  });
}
