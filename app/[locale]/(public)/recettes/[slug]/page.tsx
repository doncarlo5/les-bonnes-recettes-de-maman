import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { RecipeDetailPage } from "@/components/recipes/recipe-detail-page";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  hasRecipeAdminAccess,
  requestRecipeAdminAccessAction,
} from "./actions";

type PageProps = {
  params: Promise<{
    locale: Locale;
    slug: string;
  }>;
};

// Deduped across generateMetadata + the page render within one request.
const getRecipe = cache((locale: Locale, slug: string) =>
  fetchQuery(api.recipes.getBySlug, { locale, slug }),
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const recipe = await getRecipe(locale, slug);

  if (!recipe) {
    return {};
  }

  const description = recipe.description ?? undefined;

  return {
    title: recipe.title,
    description,
    alternates: {
      canonical: `/${locale}/recettes/${slug}`,
      languages: {
        fr: `/fr/recettes/${slug}`,
        en: `/en/recettes/${slug}`,
        "x-default": `/fr/recettes/${slug}`,
      },
    },
    openGraph: {
      type: "article",
      title: recipe.title,
      description,
      url: `/${locale}/recettes/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: recipe.title,
      description,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale, slug } = await params;
  const dict = await getDictionary(locale);
  const recipe = await getRecipe(locale, slug);
  const hasAdminAccess = await hasRecipeAdminAccess();

  if (!recipe) {
    notFound();
  }

  return (
    <RecipeDetailPage
      locale={locale}
      dict={dict}
      recipe={recipe}
      hasAdminAccess={hasAdminAccess}
      requestAdminAccessAction={requestRecipeAdminAccessAction}
    />
  );
}
