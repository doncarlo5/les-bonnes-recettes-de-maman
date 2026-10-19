import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { legacyIngredientId, legacyStepId } from "../lib/recipe-item-ids";

export const publicLocaleValidator = v.union(
  v.literal("fr"),
  v.literal("en"),
  v.literal("pt-br"),
  v.literal("nl-be"),
);

export type PublicLocale = "fr" | "en" | "pt-br" | "nl-be";

export function isPublicLocale(value: unknown): value is PublicLocale {
  return value === "fr" || value === "en" || value === "pt-br" || value === "nl-be";
}
export type TranslatedLocale = Exclude<PublicLocale, "fr" | "en">;
export const translatedLocales: TranslatedLocale[] = ["pt-br", "nl-be"];

// Convex field names cannot contain "-", so stored keys drop it.
export const storedTranslationKey = {
  "pt-br": "ptBR",
  "nl-be": "nlBE",
} as const satisfies Record<TranslatedLocale, string>;

type RecipeDoc = Doc<"recipes">;
export type StoredLocalizedRecipe = RecipeDoc["translations"]["fr"];

// When a translation is missing or no longer matches the French structure,
// show the closest edited language instead of a mismatched recipe.
const fallbackLocale: Record<TranslatedLocale, "fr" | "en"> = {
  "pt-br": "en",
  "nl-be": "fr",
};

function ingredientIds(
  ingredients: StoredLocalizedRecipe["ingredients"],
  scope: string,
) {
  return ingredients.map((ingredient, index) =>
    ingredient.id ?? legacyIngredientId(scope, index),
  );
}

function stepIds(section: StoredLocalizedRecipe["sections"][number], sectionIndex: number) {
  return section.stepDetails?.map((step) => step.id) ??
    section.steps.map((_, stepIndex) => legacyStepId(sectionIndex, stepIndex));
}

/** Ingredient and step identity that a translation must share with French. */
export function recipeStructure(localized: StoredLocalizedRecipe) {
  return JSON.stringify({
    ingredients: ingredientIds(localized.ingredients, "main"),
    sections: localized.sections.map(stepIds),
    subRecipes: localized.subRecipes.map((subRecipe, index) =>
      ingredientIds(subRecipe.ingredients, `sub-${index}`),
    ),
  });
}

export function publishedTranslation(
  recipe: Pick<RecipeDoc, "translations" | "extraTranslations">,
  locale: PublicLocale,
): StoredLocalizedRecipe {
  if (locale === "fr" || locale === "en") return recipe.translations[locale];
  const translated = recipe.extraTranslations?.[storedTranslationKey[locale]];
  if (
    translated &&
    recipeStructure(translated) === recipeStructure(recipe.translations.fr)
  ) {
    return translated;
  }
  return recipe.translations[fallbackLocale[locale]];
}

type IngredientText = { name: string; quantity: string; unit: string; notes: string };

export type RecipeTranslationFile = {
  slug: string;
  translations: Record<TranslatedLocale, {
    title: string;
    author: string;
    description: string;
    yieldLabel: string;
    prepTime: string;
    cookTime: string;
    restTime: string;
    totalTime: string;
    timeLabel: string;
    temperature: string;
    equipment: string[];
    notes: string[];
    ingredients: Record<string, IngredientText>;
    sections: { title: string; steps: Record<string, string> }[];
    subRecipes: { title: string; ingredients: Record<string, IngredientText> }[];
  }>;
};

function requireText(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  return value;
}

function sameLength(values: unknown, expected: number, path: string) {
  if (!Array.isArray(values) || values.length !== expected) {
    throw new Error(`${path} must have ${expected} items`);
  }
  return values;
}

function translateIngredients(
  ingredients: StoredLocalizedRecipe["ingredients"],
  scope: string,
  texts: Record<string, IngredientText> | undefined,
  path: string,
) {
  const ids = ingredientIds(ingredients, scope);
  const unknown = Object.keys(texts ?? {}).filter((id) => !ids.includes(id));
  if (unknown.length) throw new Error(`${path} has unknown ids: ${unknown.join(", ")}`);
  return ingredients.map((ingredient, index) => {
    const text = texts?.[ids[index]];
    if (!text) throw new Error(`${path}.${ids[index]} is missing`);
    return {
      ...ingredient,
      name: requireText(text.name, `${path}.${ids[index]}.name`),
      quantity: requireText(text.quantity, `${path}.${ids[index]}.quantity`),
      unit: requireText(text.unit, `${path}.${ids[index]}.unit`),
      notes: requireText(text.notes, `${path}.${ids[index]}.notes`),
    };
  });
}

/**
 * Applies translated text onto the published French recipe. Ids, step
 * ingredient links and legacy fields come from French, so a translation can
 * only change wording.
 */
export function applyRecipeTranslation(
  french: StoredLocalizedRecipe,
  text: RecipeTranslationFile["translations"][TranslatedLocale],
  path: string,
): StoredLocalizedRecipe {
  const sections = sameLength(text.sections, french.sections.length, `${path}.sections`) as typeof text.sections;
  const subRecipes = sameLength(text.subRecipes, french.subRecipes.length, `${path}.subRecipes`) as typeof text.subRecipes;
  return {
    ...french,
    title: requireText(text.title, `${path}.title`),
    author: requireText(text.author, `${path}.author`),
    description: requireText(text.description, `${path}.description`),
    yieldLabel: requireText(text.yieldLabel, `${path}.yieldLabel`),
    prepTime: requireText(text.prepTime, `${path}.prepTime`),
    cookTime: requireText(text.cookTime, `${path}.cookTime`),
    restTime: requireText(text.restTime, `${path}.restTime`),
    totalTime: requireText(text.totalTime, `${path}.totalTime`),
    timeLabel: requireText(text.timeLabel, `${path}.timeLabel`),
    temperature: requireText(text.temperature, `${path}.temperature`),
    equipment: (sameLength(text.equipment, french.equipment?.length ?? 0, `${path}.equipment`) as unknown[])
      .map((item, index) => requireText(item, `${path}.equipment[${index}]`)),
    notes: (sameLength(text.notes, french.notes.length, `${path}.notes`) as unknown[])
      .map((item, index) => requireText(item, `${path}.notes[${index}]`)),
    ingredients: translateIngredients(french.ingredients, "main", text.ingredients, `${path}.ingredients`),
    sections: french.sections.map((section, sectionIndex) => {
      const translated = sections[sectionIndex];
      const ids = stepIds(section, sectionIndex);
      const unknown = Object.keys(translated.steps ?? {}).filter((id) => !ids.includes(id));
      if (unknown.length) throw new Error(`${path}.sections[${sectionIndex}] has unknown steps: ${unknown.join(", ")}`);
      const texts = ids.map((id) =>
        requireText(translated.steps?.[id], `${path}.sections[${sectionIndex}].steps.${id}`),
      );
      return {
        ...section,
        title: requireText(translated.title, `${path}.sections[${sectionIndex}].title`),
        steps: texts,
        ...(section.stepDetails
          ? { stepDetails: section.stepDetails.map((step, index) => ({ ...step, text: texts[index] })) }
          : {}),
      };
    }),
    subRecipes: french.subRecipes.map((subRecipe, index) => ({
      ...subRecipe,
      title: requireText(subRecipes[index].title, `${path}.subRecipes[${index}].title`),
      ingredients: translateIngredients(
        subRecipe.ingredients,
        `sub-${index}`,
        subRecipes[index].ingredients,
        `${path}.subRecipes[${index}].ingredients`,
      ),
    })),
  };
}
