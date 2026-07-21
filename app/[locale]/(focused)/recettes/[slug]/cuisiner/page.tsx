import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { GuidedCookMode } from "@/components/recipes/guided-cook-mode";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale } from "@/i18n/config";
import { getPublicRecipeE2EFixture } from "@/components/recipes/admin-recipe-e2e-fixtures";
import { parseSelectedServings } from "@/lib/recipe-servings";
import {
  normalizeRecipeForDisplay,
  type PublicRecipeWire,
} from "@/lib/recipe-public";

const getRecipe = cache((locale: "fr" | "en", slug: string) => {
  const fixture = getPublicRecipeE2EFixture(locale, slug);
  const result = fixture
    ? Promise.resolve(fixture)
    : fetchQuery(api.recipes.getBySlug, { locale, slug });
  return result.then((recipe) =>
    recipe ? normalizeRecipeForDisplay(recipe as PublicRecipeWire) : null,
  );
});

export default async function CookPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ personnes?: string | string[] }>;
}) {
  const { locale, slug } = await params;
  const selectedServings = parseSelectedServings(
    (await searchParams).personnes,
  );
  if (!hasLocale(locale)) notFound();

  const [dict, recipe] = await Promise.all([
    getDictionary(locale),
    getRecipe(locale, slug),
  ]);
  if (!recipe) notFound();

  return (
    <GuidedCookMode
      locale={locale}
      dict={dict}
      recipe={recipe}
      selectedServings={selectedServings ?? undefined}
    />
  );
}
