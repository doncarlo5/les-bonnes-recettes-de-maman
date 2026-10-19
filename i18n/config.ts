export const locales = ["fr", "en", "pt-br", "nl-be"] as const;

export const defaultLocale = "fr";

export type Locale = (typeof locales)[number];

// Locales edited in the admin. The others are published translations of them.
export const contentLocales = ["fr", "en"] as const;

export type ContentLocale = (typeof contentLocales)[number];

export type TranslatedLocale = Exclude<Locale, ContentLocale>;

export const translatedLocales = locales.filter(
  (locale): locale is TranslatedLocale => !isContentLocale(locale),
);

export const localeDetails: Record<
  Locale,
  { short: string; name: string; htmlLang: string; ogLocale: string }
> = {
  fr: { short: "fr", name: "Français", htmlLang: "fr", ogLocale: "fr_FR" },
  en: { short: "en", name: "English", htmlLang: "en", ogLocale: "en_US" },
  "pt-br": { short: "pt", name: "Português (Brasil)", htmlLang: "pt-BR", ogLocale: "pt_BR" },
  "nl-be": { short: "nl", name: "Nederlands (België)", htmlLang: "nl-BE", ogLocale: "nl_BE" },
};

export function hasLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function isContentLocale(locale: string): locale is ContentLocale {
  return contentLocales.includes(locale as ContentLocale);
}

/** hreflang map for a path that exists in every locale, e.g. "/recettes". */
export function localeAlternates(path = "", base = "") {
  return {
    ...Object.fromEntries(
      locales.map((locale) => [localeDetails[locale].htmlLang, `${base}/${locale}${path}`]),
    ),
    "x-default": `${base}/${defaultLocale}${path}`,
  };
}
