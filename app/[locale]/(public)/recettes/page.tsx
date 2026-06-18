import { fetchQuery } from "convex/nextjs";
import { RecipeListPage } from "@/components/recipes/recipe-list-page";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
  searchParams: Promise<{
    cat?: string | string[];
    q?: string | string[];
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { cat, q } = await searchParams;
  const dict = await getDictionary(locale);
  const recipes = await fetchQuery(api.recipes.list, { locale });
  const hasInitialFilters =
    Boolean(Array.isArray(q) ? q[0]?.trim() : q?.trim()) ||
    (Array.isArray(cat) ? cat.length > 0 : Boolean(cat));

  return (
    <RecipeListPage
      locale={locale}
      dict={dict}
      recipes={recipes}
      hasInitialFilters={hasInitialFilters}
    />
  );
}
