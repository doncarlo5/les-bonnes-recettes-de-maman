export type RecipeLocale = "fr" | "en";

type LegacyServings = { quantity: number; unit: string } | null | undefined;

export const MIN_REFERENCE_SERVINGS = 1;
export const MAX_REFERENCE_SERVINGS = 50;
const NUMBER_PATTERN = "(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?)";
const RANGE_PATTERN = new RegExp(`^(${NUMBER_PATTERN})(\\s*(?:à|to|[-–—])\\s*)(${NUMBER_PATTERN})$`, "i");
const SINGLE_PATTERN = new RegExp(`^${NUMBER_PATTERN}$`);

export function formatScaledIngredientQuantity(
  quantity: string,
  factor: number,
  locale: RecipeLocale,
) {
  if (factor === 1 || !Number.isFinite(factor)) return quantity;

  const trimmed = quantity.trim();
  const range = trimmed.match(RANGE_PATTERN);
  if (range) {
    const start = parseNumericQuantity(range[1]);
    const end = parseNumericQuantity(range[3]);
    if (start === null || end === null) return quantity;
    return `${formatNumber(start * factor, locale)}${range[2]}${formatNumber(end * factor, locale)}`;
  }

  if (!SINGLE_PATTERN.test(trimmed)) return quantity;
  const value = parseNumericQuantity(trimmed);
  return value === null ? quantity : formatNumber(value * factor, locale);
}

export function formatScaledIngredient(
  ingredient: { quantity: string; unit: string },
  factor: number,
  locale: RecipeLocale,
) {
  const quantity = formatScaledIngredientQuantity(ingredient.quantity, factor, locale);
  return [quantity, ingredient.unit].filter(Boolean).join(" ");
}

export function parseSelectedServings(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const servings = Number(value);
  return Number.isInteger(servings) && servings >= MIN_REFERENCE_SERVINGS && servings <= MAX_REFERENCE_SERVINGS
    ? servings
    : null;
}

export function resolveReferenceServings(
  referenceServings: number | undefined,
  legacyServings?: LegacyServings,
) {
  if (isValidReferenceServings(referenceServings)) return referenceServings;
  if (!legacyServings || !isValidReferenceServings(legacyServings.quantity)) return undefined;

  const unit = legacyServings.unit.trim().toLowerCase();
  return ["personne", "personnes", "serving", "servings", "people"].includes(unit)
    ? legacyServings.quantity
    : undefined;
}

export function isValidReferenceServings(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= MIN_REFERENCE_SERVINGS && value <= MAX_REFERENCE_SERVINGS;
}

export function resolveSelectedServings(
  referenceServings: number | undefined,
  selectedServings: number | undefined,
) {
  if (!isValidReferenceServings(referenceServings)) return undefined;
  return isValidReferenceServings(selectedServings) ? selectedServings : referenceServings;
}

export function getServingsFactor(
  referenceServings: number | undefined,
  selectedServings: number | undefined,
) {
  const effectiveServings = resolveSelectedServings(referenceServings, selectedServings);
  return effectiveServings && referenceServings
    ? effectiveServings / referenceServings
    : 1;
}

export function buildServingsQuery(
  referenceServings: number | undefined,
  selectedServings: number | undefined,
) {
  const effectiveServings = resolveSelectedServings(referenceServings, selectedServings);
  return effectiveServings && effectiveServings !== referenceServings
    ? `?personnes=${effectiveServings}`
    : "";
}

function parseNumericQuantity(quantity: string) {
  const mixed = quantity.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator === 0 ? null : Number(mixed[1]) + Number(mixed[2]) / denominator;
  }

  const fraction = quantity.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }

  const value = Number(quantity.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function formatNumber(value: number, locale: RecipeLocale) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(Math.round((value + Number.EPSILON) * 100) / 100);
}
