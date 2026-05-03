import { fetchQuery } from "convex/nextjs";
import { RecipeListPage } from "@/components/recipes/recipe-list-page";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const recipes = await fetchQuery(api.recipes.list);

  return <RecipeListPage locale={locale} dict={dict} recipes={recipes} />;
}
