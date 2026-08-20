import type { Locale } from "@/i18n/config";

const frenchVowelInitial = /^[aeiouyæœ]/i;

export function startsWithFrenchVowel(value: string) {
  return frenchVowelInitial.test(value.trimStart().normalize("NFD"));
}

export function formatRecipeByline(
  locale: Locale,
  recipeByLabel: string,
  author: string,
) {
  const normalizedAuthor = author.trimStart();

  if (locale === "fr" && startsWithFrenchVowel(normalizedAuthor)) {
    const contractedLabel = recipeByLabel.replace(/\bde\s*$/iu, "d’");
    if (contractedLabel !== recipeByLabel) {
      return `${contractedLabel}${normalizedAuthor}`;
    }
  }

  return `${recipeByLabel} ${normalizedAuthor}`;
}
