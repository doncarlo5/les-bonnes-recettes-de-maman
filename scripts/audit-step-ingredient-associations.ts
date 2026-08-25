import { recipeCatalog } from "../convex/recipeCatalog";

let steps = 0;
let enrichedSteps = 0;
let references = 0;

for (const recipe of recipeCatalog) {
  for (const section of recipe.translations.fr.sections) {
    for (const step of section.stepDetails ?? []) {
      steps += 1;
      if (step.ingredientUses.length > 0) enrichedSteps += 1;
      references += step.ingredientUses.length;
    }
  }
}

console.log({
  recipes: recipeCatalog.length,
  steps,
  enrichedSteps,
  intentionallyEmptySteps: steps - enrichedSteps,
  references,
});
