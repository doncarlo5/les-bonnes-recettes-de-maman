import { fetchQuery } from "convex/nextjs";
import { HomePage } from "@/components/home/home-page";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { getPublicRecipeE2EFixture } from "@/components/recipes/admin-recipe-e2e-fixtures";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const fixture = getPublicRecipeE2EFixture(locale);
  const recipes = fixture ? [fixture] : await fetchQuery(api.recipes.list, { locale });

  return <HomePage locale={locale} dict={dict} recipes={recipes} />;
}
