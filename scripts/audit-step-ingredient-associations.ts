import recipes from "../convex/recettes.json";
import type { SourceRecipe } from "../convex/recipeTranslations";
import { enrichLocalizedStepIngredients } from "../lib/recipe-step-migration";

let steps = 0;
let enrichedSteps = 0;
let references = 0;

for (const recipe of recipes) {
  const source = recipe as unknown as SourceRecipe;
  const enriched = enrichLocalizedStepIngredients({
    ...source,
    subRecipes: source.subRecipes ?? [],
  });
  for (const section of enriched.sections) {
    for (const step of section.stepDetails ?? []) {
      steps += 1;
      if (step.ingredientUses.length > 0) enrichedSteps += 1;
      references += step.ingredientUses.length;
    }
  }
}

console.log({
  recipes: recipes.length,
  steps,
  enrichedSteps,
  intentionallyEmptySteps: steps - enrichedSteps,
  references,
});
