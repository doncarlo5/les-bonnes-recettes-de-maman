export type LegacyServings = {
  quantity: number;
  unit: string;
};

type LegacyLocalizedYield = {
  yieldLabel?: string;
  servings?: LegacyServings | null;
};

export function resolveYieldLabel({
  locale,
  slug,
  yieldLabel,
  servings,
}: {
  locale: "fr" | "en";
  slug: string;
  yieldLabel?: string;
  servings?: LegacyServings | null;
}) {
  if (yieldLabel !== undefined) return yieldLabel.trim();
  if (!servings) return "";

  if (slug === "gougeres" && ["environ", "about"].includes(servings.unit.trim().toLowerCase())) {
    return locale === "fr"
      ? `Environ ${servings.quantity} gougères`
      : `About ${servings.quantity} gougères`;
  }

  return `${servings.quantity} ${servings.unit}`.trim();
}

export function backfillYieldLabels<
  T extends Record<"fr" | "en", LegacyLocalizedYield>,
>(slug: string, translations: T): T {
  if (
    translations.fr.yieldLabel !== undefined &&
    translations.en.yieldLabel !== undefined
  ) {
    return translations;
  }

  return {
    ...translations,
    fr: {
      ...translations.fr,
      yieldLabel: resolveYieldLabel({
        locale: "fr",
        slug,
        yieldLabel: translations.fr.yieldLabel,
        servings: translations.fr.servings,
      }),
    },
    en: {
      ...translations.en,
      yieldLabel: resolveYieldLabel({
        locale: "en",
        slug,
        yieldLabel: translations.en.yieldLabel,
        servings: translations.en.servings,
      }),
    },
  } as T;
}
