import type { Locale } from "@/i18n/config";

const emphasizedPhraseByRecipe: Partial<
  Record<string, Partial<Record<Locale, string>>>
> = {
  "banana-bread-du-kona-inn": {
    fr: "sans trop travailler la pâte",
    en: "without overmixing",
  },
};

export function RecipeStepText({
  locale,
  recipeSlug,
  text,
}: {
  locale: Locale;
  recipeSlug: string;
  text: string;
}) {
  const phrase = emphasizedPhraseByRecipe[recipeSlug]?.[locale];
  const phraseIndex = phrase ? text.indexOf(phrase) : -1;

  if (!phrase || phraseIndex === -1) return text;

  return (
    <>
      {text.slice(0, phraseIndex)}
      <span className="font-semibold">{phrase}</span>
      {text.slice(phraseIndex + phrase.length)}
    </>
  );
}
