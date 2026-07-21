import type { Locale } from "@/i18n/config";
import { resolveStepIngredients } from "@/lib/recipe-step-ingredients";
import type { Recipe, RecipeStep } from "./types";

export function StepIngredients({
  locale,
  label,
  recipe,
  step,
  factor,
}: {
  locale: Locale;
  label: string;
  recipe: Pick<Recipe, "ingredients" | "subRecipes">;
  step: RecipeStep;
  factor: number;
}) {
  const ingredients = resolveStepIngredients(
    recipe,
    step.ingredientUses,
    factor,
    locale,
  );
  if (ingredients.length === 0) return null;

  return (
    <div className="mt-4" data-step-ingredients>
      <p className="type-label mb-2 text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {ingredients.map((ingredient) => (
          <li
            key={ingredient.id}
            className="inline-flex max-w-full items-baseline gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground"
          >
            {ingredient.amount ? (
              <span className="shrink-0 tabular-nums">{ingredient.amount}</span>
            ) : null}
            {ingredient.amount ? <span aria-hidden>·</span> : null}
            <span className="truncate first-letter:uppercase">{ingredient.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
