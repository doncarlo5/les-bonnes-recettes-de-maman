import type { Locale } from "./config";
import type { Dictionary } from "./get-dictionary";
import fr from "./dictionaries/fr.json";
import en from "./dictionaries/en.json";
import ptBr from "./dictionaries/pt-br.json";
import nlBe from "./dictionaries/nl-be.json";

export const clientDictionaries: Record<Locale, Dictionary> = {
  fr,
  en,
  "pt-br": ptBr,
  "nl-be": nlBe,
};
