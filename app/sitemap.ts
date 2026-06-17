import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { siteUrl } from "@/lib/site";
import { locales, defaultLocale } from "@/i18n/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Recipes share one slug across locales — fetch once to enumerate them.
  let recipes: { slug: string }[] = [];
  try {
    recipes = await fetchQuery(api.recipes.list, { locale: defaultLocale });
  } catch {
    recipes = [];
  }

  const homeLanguages = {
    fr: `${siteUrl}/fr`,
    en: `${siteUrl}/en`,
  };

  const entries: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    changeFrequency: "weekly",
    priority: 1,
    alternates: { languages: homeLanguages },
  }));

  for (const recipe of recipes) {
    const languages = {
      fr: `${siteUrl}/fr/recettes/${recipe.slug}`,
      en: `${siteUrl}/en/recettes/${recipe.slug}`,
    };
    for (const locale of locales) {
      entries.push({
        url: `${siteUrl}/${locale}/recettes/${recipe.slug}`,
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: { languages },
      });
    }
  }

  return entries;
}
