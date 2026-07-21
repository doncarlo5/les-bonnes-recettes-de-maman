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

type CompleteLocalized = Omit<
  LegacyLocalized,
  "ingredients" | "sections" | "subRecipes"
> & {
  ingredients: Array<LegacyIngredient & { id: string }>;
  sections: Array<
    LegacySection & { stepDetails: NonNullable<LegacySection["stepDetails"]> }
  >;
  subRecipes: Array<{
    title: string;
    ingredients: Array<LegacyIngredient & { id: string }>;
  }>;
};

export function backfillLocalizedStepIngredients<T extends LegacyLocalized>(
  localized: T,
): T & LegacyLocalized {
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
      stepDetails:
        section.stepDetails ??
        section.steps.map((text, stepIndex) => ({
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

/**
 * One-time catalogue enrichment. It is deliberately conservative: only an
 * ingredient explicitly named (or covered by a small culinary alias) is
 * attached, and existing editorial associations always win.
 */
export function enrichLocalizedStepIngredients<T extends LegacyLocalized>(
  localized: T,
): T & LegacyLocalized {
  const complete = backfillLocalizedStepIngredients(
    localized,
  ) as unknown as CompleteLocalized;
  const ingredients = [
    ...complete.ingredients,
    ...complete.subRecipes.flatMap((subRecipe) => subRecipe.ingredients),
  ];
  const mentionsByCanonicalName = new Map<string, number>();
  let changed = false;
  const sections = complete.sections.map((section) => ({
    ...section,
    stepDetails: section.stepDetails.map((step) => {
      if (step.ingredientUses.length > 0) return step;
      const ingredientUses = resolveMentionedIngredients(
        step.text,
        ingredients,
        mentionsByCanonicalName,
      ).map((ingredient) => ({ ingredientId: ingredient.id }));
      if (ingredientUses.length === 0) return step;
      changed = true;
      return { ...step, ingredientUses };
    }),
  }));
  return (changed ? { ...complete, sections } : complete) as T &
    LegacyLocalized;
}

function resolveMentionedIngredients(
  text: string,
  ingredients: Array<LegacyIngredient & { id: string }>,
  mentionsByCanonicalName: Map<string, number>,
) {
  const stepTokens = tokenize(text);
  const candidates = ingredients.flatMap((ingredient, index) => {
    const ingredientTokens = tokenizeIngredient(ingredient.name);
    const matched = [...ingredientTokens].filter((token) =>
      stepTokens.has(token),
    );
    return matched.length
      ? [{ ingredient, index, ingredientTokens, matched }]
      : [];
  });

  const components: (typeof candidates)[] = [];
  for (const candidate of candidates) {
    const connected = components.filter((component) =>
      component.some((other) =>
        intersects(candidate.ingredientTokens, other.ingredientTokens),
      ),
    );
    if (connected.length === 0) {
      components.push([candidate]);
      continue;
    }
    const merged = [candidate, ...connected.flat()];
    for (const component of connected)
      components.splice(components.indexOf(component), 1);
    components.push(merged);
  }

  return components.flatMap((component) => {
    const scored = component.map((candidate) => ({
      ...candidate,
      ratio: candidate.matched.length / candidate.ingredientTokens.size,
    }));
    const bestRatio = Math.max(...scored.map((candidate) => candidate.ratio));
    let best = scored.filter((candidate) => candidate.ratio === bestRatio);
    if (bestRatio === 1) {
      const mostSpecific = Math.max(
        ...best.map((candidate) => candidate.ingredientTokens.size),
      );
      best = best.filter(
        (candidate) => candidate.ingredientTokens.size === mostSpecific,
      );
    } else {
      const mostMatches = Math.max(
        ...best.map((candidate) => candidate.matched.length),
      );
      best = best.filter(
        (candidate) => candidate.matched.length === mostMatches,
      );
    }

    const canonicalGroups = new Map<string, typeof best>();
    for (const candidate of best) {
      const canonical = canonicalName(candidate.ingredient.name);
      canonicalGroups.set(canonical, [
        ...(canonicalGroups.get(canonical) ?? []),
        candidate,
      ]);
    }
    return [...canonicalGroups.entries()].map(
      ([canonical, duplicateCandidates]) => {
        duplicateCandidates.sort((left, right) => left.index - right.index);
        const mention = mentionsByCanonicalName.get(canonical) ?? 0;
        mentionsByCanonicalName.set(canonical, mention + 1);
        return duplicateCandidates[
          Math.min(mention, duplicateCandidates.length - 1)
        ].ingredient;
      },
    );
  });
}

const ignoredTokens = new Set([
  "avec",
  "bien",
  "concasse",
  "concassee",
  "de",
  "des",
  "du",
  "en",
  "entier",
  "entiere",
  "epais",
  "epaisse",
  "fin",
  "fine",
  "frais",
  "fraiche",
  "gros",
  "grosse",
  "hache",
  "hachee",
  "moulu",
  "moulue",
  "petit",
  "petite",
  "sans",
  "temperature",
  "t45",
  "t55",
  "vert",
  "verte",
  "and",
  "at",
  "chopped",
  "cold",
  "fresh",
  "ground",
  "large",
  "of",
  "room",
  "small",
  "temperature",
  "the",
  "to",
  "whole",
  "with",
  "without",
]);

function tokenize(value: string) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token && !ignoredTokens.has(token))
      .map(stem),
  );
}

function tokenizeIngredient(name: string) {
  const tokens = tokenize(name);
  const normalized = normalize(name);
  if (
    /\b(comte|gruyere|chevre|parmesan|mascarpone|vache|kiri)\b/.test(normalized)
  ) {
    tokens.add("fromage");
    tokens.add("cheese");
  }
  if (/\b(vache|kiri)\b/.test(normalized)) tokens.add("fondu");
  if (/\b(persil|ciboulette|parsley|chives)\b/.test(normalized))
    tokens.add("herbe");
  if (
    /\b(courgette|pomme de terre|ail|oignon|carotte|zucchini|potato|garlic|onion|carrot)\b/.test(
      normalized,
    )
  ) {
    tokens.add("legume");
    tokens.add("vegetable");
  }
  if (/\bastra\b/.test(normalized)) tokens.add("margarine");
  if (/\b(marsala|xeres|malaga)\b/.test(normalized)) {
    tokens.add("alcool");
    tokens.add("alcohol");
  }
  return tokens;
}

function canonicalName(value: string) {
  return [...tokenizeIngredient(value)].sort().join("|");
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replaceAll("œ", "oe")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length <= 3) return token;
  return token
    .replace(/(ies)$/i, "y")
    .replace(/(ees|es|s|x)$/i, "")
    .replace(/(ed)$/i, "");
}

function intersects(left: Set<string>, right: Set<string>) {
  return [...left].some((token) => right.has(token));
}
