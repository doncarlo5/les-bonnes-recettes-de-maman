export function createRecipeItemId(prefix: "ingredient" | "step") {
  const random = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function legacyIngredientId(scope: string, index: number) {
  return `ingredient-${scope}-${index}`;
}

export function legacyStepId(sectionIndex: number, stepIndex: number) {
  return `step-${sectionIndex}-${stepIndex}`;
}
