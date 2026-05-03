import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { RecipeDetailPage } from "@/components/recipes/recipe-detail-page";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type PageProps = {
  params: Promise<{
    locale: Locale;
    slug: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { locale, slug } = await params;
  const dict = await getDictionary(locale);
  const recipe = await fetchQuery(api.recipes.getBySlug, { locale, slug });

  if (!recipe) {
    notFound();
  }

  return <RecipeDetailPage locale={locale} dict={dict} recipe={recipe} />;
}
