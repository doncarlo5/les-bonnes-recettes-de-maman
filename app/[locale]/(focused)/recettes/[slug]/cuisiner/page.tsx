import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { GuidedCookMode } from "@/components/recipes/guided-cook-mode";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale } from "@/i18n/config";
import { getPublicRecipeE2EFixture } from "@/components/recipes/admin-recipe-e2e-fixtures";

const getRecipe = cache((locale: "fr" | "en", slug: string) => {
  const fixture = getPublicRecipeE2EFixture(locale, slug);
  return fixture ? Promise.resolve(fixture) : fetchQuery(api.recipes.getBySlug, { locale, slug });
});

export default async function CookPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(locale)) notFound();

  const [dict, recipe] = await Promise.all([
    getDictionary(locale),
    getRecipe(locale, slug),
  ]);
  if (!recipe) notFound();

  return <GuidedCookMode locale={locale} dict={dict} recipe={recipe} />;
}
