import { isValidReferenceServings } from "./recipe-servings";

export const RECIPE_FIELD_LIMITS = {
  title: 200,
  author: 160,
  description: 8_000,
  ingredientName: 300,
  shortValue: 100,
  longText: 2_000,
  creditText: 1_000,
  url: 2_048,
  draftBytes: 500_000,
} as const;

export type RecipeAdminSection =
  | "essentials"
  | "photo"
  | "details"
  | "ingredients"
  | "preparation"
  | "notes"
  | "translation";

export type ReadinessItem = {
  code: string;
  level: "blocker" | "warning";
  label: string;
  section: RecipeAdminSection;
  locale: "fr" | "en";
  field: string;
};

type IngredientContent = {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

type LocalizedRecipeContent = {
  title: string;
  author: string;
  description: string;
  yieldLabel: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  timeLabel: string;
  temperature: string;
  ingredients: IngredientContent[];
  sections: Array<{ title: string; steps: string[] }>;
  subRecipes: Array<{ title: string; ingredients: IngredientContent[] }>;
  notes: string[];
};

export type RecipeDraftContentLike = {
  defaultLocale: "fr" | "en";
  referenceServings?: number;
  translations: { fr: LocalizedRecipeContent; en: LocalizedRecipeContent };
  tags: string[];
};

export type RecipeReadiness = {
  sections: Record<RecipeAdminSection, boolean>;
  translation: { fr: boolean; en: boolean };
  blockers: ReadinessItem[];
  warnings: ReadinessItem[];
};

export function getPublicationState(
  status: "draft" | "published",
  revision: number,
  publishedRevision: number,
) {
  const hasPublishedVersion = publishedRevision >= 0;
  const hasUnpublishedChanges = revision !== publishedRevision;
  return {
    isPublic: status === "published",
    hasPublishedVersion,
    hasUnpublishedChanges,
    canDiscard: hasPublishedVersion && hasUnpublishedChanges,
  };
}

export function getRecipeReadiness(
  recipe: RecipeDraftContentLike,
  hasImage: boolean,
): RecipeReadiness {
  const fr = recipe.translations.fr;
  const en = recipe.translations.en;
  const hasTime = [fr.prepTime, fr.cookTime, fr.totalTime, fr.timeLabel].some(hasText);
  const hasIngredient = fr.ingredients.some((item) => hasText(item.name));
  const hasReferenceServings = isValidReferenceServings(recipe.referenceServings);
  const hasPreparation = fr.sections.some(
    (section) => hasText(section.title) && section.steps.some(hasText),
  );
  const essentials = hasText(fr.title) && hasText(fr.author) && hasText(fr.description);
  const translationEn =
    hasText(en.title) &&
    hasText(en.description) &&
    en.ingredients.some((item) => hasText(item.name));

  const blockers = [
    readinessItem(!hasText(fr.title), "fr-title", "Ajoute un titre français.", "essentials", "fr", "translations.fr.title"),
    readinessItem(!hasText(fr.author), "fr-author", "Ajoute l’auteur.", "essentials", "fr", "translations.fr.author"),
    readinessItem(!hasText(fr.description), "fr-description", "Ajoute une description française.", "essentials", "fr", "translations.fr.description"),
    readinessItem(!hasTime, "fr-time", "Indique au moins un temps.", "details", "fr", "translations.fr.timeLabel"),
    readinessItem(!hasIngredient, "fr-ingredient", "Ajoute au moins un ingrédient.", "ingredients", "fr", "translations.fr.ingredients.0.name"),
    readinessItem(!hasReferenceServings, "reference-servings", "Indique les portions de référence.", "ingredients", "fr", "referenceServings"),
    readinessItem(!hasPreparation, "fr-preparation", "Ajoute une section avec une étape.", "preparation", "fr", "translations.fr.sections.0.title"),
  ].filter((item): item is ReadinessItem => item !== null);

  const warnings = [
    readinessWarning(!hasImage, "main-image", "Ajoute une image principale.", "photo", "fr", "heroImageUrl"),
    readinessWarning(!translationEn, "en-translation", "La traduction anglaise est encore incomplète.", "translation", "en", "translations.en.title"),
  ].filter((item): item is ReadinessItem => item !== null);

  return {
    sections: {
      essentials,
      photo: hasImage,
      details: hasTime,
      ingredients: hasIngredient && hasReferenceServings,
      preparation: hasPreparation,
      notes: true,
      translation: translationEn,
    },
    translation: {
      fr: essentials && hasTime && hasIngredient && hasPreparation,
      en: translationEn,
    },
    blockers,
    warnings,
  };
}

export function assertRecipeDraftLimits(value: RecipeDraftContentLike) {
  if (value.referenceServings !== undefined && !isValidReferenceServings(value.referenceServings)) {
    throw new Error("RECIPE_LIMIT_EXCEEDED");
  }
  const { title, author, description, ingredientName, shortValue, longText } = RECIPE_FIELD_LIMITS;
  for (const localized of Object.values(value.translations)) {
    assertLength(localized.title, title);
    assertLength(localized.author, author);
    assertLength(localized.description, description);
    assertLength(localized.yieldLabel, shortValue);
    for (const field of [localized.prepTime, localized.cookTime, localized.totalTime, localized.timeLabel, localized.temperature]) {
      assertLength(field, shortValue);
    }
    for (const ingredient of localized.ingredients) assertIngredient(ingredient);
    for (const section of localized.sections) {
      assertLength(section.title, title);
      for (const step of section.steps) assertLength(step, longText);
    }
    for (const subRecipe of localized.subRecipes) {
      assertLength(subRecipe.title, title);
      for (const ingredient of subRecipe.ingredients) assertIngredient(ingredient);
    }
    for (const note of localized.notes) assertLength(note, longText);
  }
  for (const tag of value.tags) assertLength(tag, shortValue);
  assertRecipeDraftBytes(value);

  function assertIngredient(ingredient: IngredientContent) {
    assertLength(ingredient.name, ingredientName);
    assertLength(ingredient.quantity, shortValue);
    assertLength(ingredient.unit, shortValue);
    assertLength(ingredient.notes, longText);
  }
}

export function assertRecipeDraftBytes(value: unknown) {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > RECIPE_FIELD_LIMITS.draftBytes) {
    throw new Error("RECIPE_DRAFT_TOO_LARGE");
  }
}

function assertLength(value: string, maximum: number) {
  if (value.length > maximum) throw new Error("RECIPE_LIMIT_EXCEEDED");
}

function hasText(value: string) {
  return value.trim().length > 0;
}

function readinessItem(
  include: boolean,
  code: string,
  label: string,
  section: RecipeAdminSection,
  locale: "fr" | "en",
  field: string,
): ReadinessItem | null {
  return include ? { code, level: "blocker", label, section, locale, field } : null;
}

function readinessWarning(
  include: boolean,
  code: string,
  label: string,
  section: RecipeAdminSection,
  locale: "fr" | "en",
  field: string,
): ReadinessItem | null {
  return include ? { code, level: "warning", label, section, locale, field } : null;
}
