import type { Locale } from "./config";
import type { Dictionary } from "./get-dictionary";
import fr from "./dictionaries/fr.json";
import en from "./dictionaries/en.json";

export const clientDictionaries: Record<Locale, Dictionary> = {
  fr,
  en,
};
