import "server-only";
import type { Locale } from "./config";
import fr from "./dictionaries/fr.json";

const dictionaries = {
  fr: () => import("./dictionaries/fr.json").then((module) => module.default),
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  "pt-br": () => import("./dictionaries/pt-br.json").then((module) => module.default),
  "nl-be": () => import("./dictionaries/nl-be.json").then((module) => module.default),
} satisfies Record<Locale, () => Promise<Dictionary>>;

export type Dictionary = typeof fr;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
