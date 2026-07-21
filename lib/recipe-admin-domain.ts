import { isValidReferenceServings } from "./recipe-servings";
import type { RecipeCategory } from "./recipe-categories";

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
  | "info"
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
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

type StepIngredientUseContent = {
  ingredientId: string;
  amount?: { quantity: string; unit: string };
};

type StructuredRecipeStepContent = {
  id: string;
  text: string;
  ingredientUses: StepIngredientUseContent[];
};

type LocalizedRecipeContent = {
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
  ingredients: IngredientContent[];
  sections: Array<{
    title: string;
    steps: Array<string | StructuredRecipeStepContent>;
  }>;
  subRecipes: Array<{ title: string; ingredients: IngredientContent[] }>;
  notes: string[];
};

export type RecipeDraftContentLike = {
  defaultLocale: "fr" | "en";
  referenceServings?: number;
  relatedRecipeSlugs: string[];
  translations: { fr: LocalizedRecipeContent; en: LocalizedRecipeContent };
  categories: RecipeCategory[];
  legacyCategoryLabels?: string[];
};

export type RecipeReadiness = {
  sections: Record<RecipeAdminSection, boolean>;
  translation: { fr: boolean; en: boolean };
  blockers: ReadinessItem[];
  warnings: ReadinessItem[];
};

export type RecipeStepReferenceIssue = {
  kind: "duplicate-ingredient-id" | "duplicate-step-id" | "missing-ingredient" | "duplicate-ingredient-use";
  locale: "fr" | "en";
  path: Array<string | number>;
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
  const hasTime = [
    fr.prepTime,
    fr.cookTime,
    fr.restTime,
    fr.totalTime,
    fr.timeLabel,
  ].some(hasText);
  const hasIngredient = fr.ingredients.some((item) => hasText(item.name));
  const hasReferenceServings = isValidReferenceServings(
    recipe.referenceServings,
  );
  const allowsYieldOnly = hasEditorialYield(fr);
  const hasPreparation = fr.sections.some(
    (section) =>
      hasText(section.title) &&
      section.steps.some((step) => hasText(typeof step === "string" ? step : step.text)),
  );
  const essentials =
    hasText(fr.title) && hasText(fr.author) && hasText(fr.description);
  const translationEn =
    hasText(en.title) &&
    hasText(en.description) &&
    en.ingredients.some((item) => hasText(item.name));

  const blockers = [
    readinessItem(
      !hasText(fr.title),
      "fr-title",
      "Ajoute un titre français.",
      "info",
      "fr",
      "translations.fr.title",
    ),
    readinessItem(
      !hasText(fr.author),
      "fr-author",
      "Ajoute l’auteur.",
      "info",
      "fr",
      "translations.fr.author",
    ),
    readinessItem(
      !hasText(fr.description),
      "fr-description",
      "Ajoute une description française.",
      "info",
      "fr",
      "translations.fr.description",
    ),
    readinessItem(
      !hasTime,
      "fr-time",
      "Indique au moins un temps.",
      "details",
      "fr",
      "translations.fr.timeLabel",
    ),
    readinessItem(
      !hasIngredient,
      "fr-ingredient",
      "Ajoute au moins un ingrédient.",
      "ingredients",
      "fr",
      "translations.fr.ingredients.0.name",
    ),
    readinessItem(
      !hasReferenceServings && !allowsYieldOnly,
      "reference-servings",
      "Indique le rendement ou les portions de référence.",
      "ingredients",
      "fr",
      "referenceServings",
    ),
    readinessItem(
      !hasPreparation,
      "fr-preparation",
      "Ajoute une section avec une étape.",
      "preparation",
      "fr",
      "translations.fr.sections.0.title",
    ),
  ].filter((item): item is ReadinessItem => item !== null);

  const warnings = [
    readinessWarning(
      !hasImage,
      "main-image",
      "Ajoute une image principale.",
      "info",
      "fr",
      "heroImageUrl",
    ),
    readinessWarning(
      !translationEn,
      "en-translation",
      "La traduction anglaise est encore incomplète.",
      "translation",
      "en",
      "translations.en.title",
    ),
  ].filter((item): item is ReadinessItem => item !== null);

  return {
    sections: {
      info: essentials,
      details: hasTime,
      ingredients: hasIngredient && (hasReferenceServings || allowsYieldOnly),
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
  if (
    value.referenceServings !== undefined &&
    !isValidReferenceServings(value.referenceServings)
  ) {
    throw new Error("RECIPE_LIMIT_EXCEEDED");
  }
  const { title, author, description, ingredientName, shortValue, longText } =
    RECIPE_FIELD_LIMITS;
  for (const localized of Object.values(value.translations)) {
    assertLength(localized.title, title);
    assertLength(localized.author, author);
    assertLength(localized.description, description);
    assertLength(localized.yieldLabel, shortValue);
    for (const field of [
      localized.prepTime,
      localized.cookTime,
      localized.restTime,
      localized.totalTime,
      localized.timeLabel,
      localized.temperature,
    ]) {
      assertLength(field, shortValue);
    }
    for (const item of localized.equipment) assertLength(item, shortValue);
    for (const ingredient of localized.ingredients)
      assertIngredient(ingredient);
    for (const section of localized.sections) {
      assertLength(section.title, title);
      for (const step of section.steps) {
        assertLength(typeof step === "string" ? step : step.text, longText);
        if (typeof step !== "string") {
          assertNonEmptyIdentifier(step.id);
          assertLength(step.id, shortValue);
          for (const use of step.ingredientUses) {
            assertNonEmptyIdentifier(use.ingredientId);
            assertLength(use.ingredientId, shortValue);
            if (use.amount) {
              assertLength(use.amount.quantity, shortValue);
              assertLength(use.amount.unit, shortValue);
            }
          }
        }
      }
    }
    for (const subRecipe of localized.subRecipes) {
      assertLength(subRecipe.title, title);
      for (const ingredient of subRecipe.ingredients)
        assertIngredient(ingredient);
    }
    for (const note of localized.notes) assertLength(note, longText);
  }
  for (const tag of value.categories) assertLength(tag, shortValue);
  for (const label of value.legacyCategoryLabels ?? [])
    assertLength(label, shortValue);
  for (const slug of value.relatedRecipeSlugs) assertLength(slug, shortValue);
  if (getRecipeStepReferenceIssues(value).length > 0) {
    throw new Error("RECIPE_INVALID_STEP_REFERENCES");
  }
  assertRecipeDraftBytes(value);

  function assertIngredient(ingredient: IngredientContent) {
    if (ingredient.id !== undefined) {
      assertNonEmptyIdentifier(ingredient.id);
      assertLength(ingredient.id, shortValue);
    }
    assertLength(ingredient.name, ingredientName);
    assertLength(ingredient.quantity, shortValue);
    assertLength(ingredient.unit, shortValue);
    assertLength(ingredient.notes, longText);
  }
}

function assertNonEmptyIdentifier(value: string) {
  if (value.length === 0) throw new Error("RECIPE_INVALID_STEP_REFERENCES");
}

export function getRecipeStepReferenceIssues(
  value: RecipeDraftContentLike,
): RecipeStepReferenceIssue[] {
  const issues: RecipeStepReferenceIssue[] = [];
  for (const locale of ["fr", "en"] as const) {
    const localized = value.translations[locale];
    const ingredientIds = new Set<string>();
    const ingredientEntries = [
      ...localized.ingredients.map((ingredient, index) => ({
        ingredient,
        path: ["translations", locale, "ingredients", index, "id"] as Array<string | number>,
      })),
      ...localized.subRecipes.flatMap((subRecipe, subRecipeIndex) =>
        subRecipe.ingredients.map((ingredient, ingredientIndex) => ({
          ingredient,
          path: [
            "translations",
            locale,
            "subRecipes",
            subRecipeIndex,
            "ingredients",
            ingredientIndex,
            "id",
          ] as Array<string | number>,
        })),
      ),
    ];
    for (const { ingredient, path } of ingredientEntries) {
      if (ingredient.id === undefined) continue;
      if (ingredientIds.has(ingredient.id)) {
        issues.push({ kind: "duplicate-ingredient-id", locale, path });
      }
      ingredientIds.add(ingredient.id);
    }

    const stepIds = new Set<string>();
    for (const [sectionIndex, section] of localized.sections.entries()) {
      for (const [stepIndex, step] of section.steps.entries()) {
        if (typeof step === "string") continue;
        const stepPath = [
          "translations",
          locale,
          "sections",
          sectionIndex,
          "steps",
          stepIndex,
        ] as Array<string | number>;
        if (stepIds.has(step.id)) {
          issues.push({
            kind: "duplicate-step-id",
            locale,
            path: [...stepPath, "id"],
          });
        }
        stepIds.add(step.id);

        const usedIngredientIds = new Set<string>();
        for (const [useIndex, use] of step.ingredientUses.entries()) {
          const path = [...stepPath, "ingredientUses", useIndex, "ingredientId"];
          if (!ingredientIds.has(use.ingredientId)) {
            issues.push({ kind: "missing-ingredient", locale, path });
          }
          if (usedIngredientIds.has(use.ingredientId)) {
            issues.push({ kind: "duplicate-ingredient-use", locale, path });
          }
          usedIngredientIds.add(use.ingredientId);
        }
      }
    }
  }
  return issues;
}

export function assertRecipeDraftBytes(value: unknown) {
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
    RECIPE_FIELD_LIMITS.draftBytes
  ) {
    throw new Error("RECIPE_DRAFT_TOO_LARGE");
  }
}

function assertLength(value: string, maximum: number) {
  if (value.length > maximum) throw new Error("RECIPE_LIMIT_EXCEEDED");
}

function hasText(value: string) {
  return value.trim().length > 0;
}

function hasEditorialYield(recipe: LocalizedRecipeContent) {
  return hasText(recipe.yieldLabel);
}

function readinessItem(
  include: boolean,
  code: string,
  label: string,
  section: RecipeAdminSection,
  locale: "fr" | "en",
  field: string,
): ReadinessItem | null {
  return include
    ? { code, level: "blocker", label, section, locale, field }
    : null;
}

function readinessWarning(
  include: boolean,
  code: string,
  label: string,
  section: RecipeAdminSection,
  locale: "fr" | "en",
  field: string,
): ReadinessItem | null {
  return include
    ? { code, level: "warning", label, section, locale, field }
    : null;
}
