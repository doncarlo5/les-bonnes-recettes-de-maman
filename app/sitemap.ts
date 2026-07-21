import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { siteUrl } from "@/lib/site";
import { locales } from "@/i18n/config";
import { collectPaginated } from "@/lib/convex-pagination";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Recipes share one slug across locales — fetch once to enumerate them.
  let recipes: { slug: string }[] = [];
  try {
    recipes = await collectPaginated<{ slug: string }>((cursor) =>
      fetchQuery(api.recipes.listSlugs, {
        paginationOpts: { numItems: 100, cursor },
      }),
    );
  } catch {
    recipes = [];
  }

  const homeLanguages = {
    fr: `${siteUrl}/fr`,
    en: `${siteUrl}/en`,
  };
  const recipeListLanguages = {
    fr: `${siteUrl}/fr/recettes`,
    en: `${siteUrl}/en/recettes`,
  };
  const ideaLanguages = {
    fr: `${siteUrl}/fr/idees`,
    en: `${siteUrl}/en/idees`,
  };

  const entries: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    changeFrequency: "weekly",
    priority: 1,
    alternates: { languages: homeLanguages },
  }));

  for (const locale of locales) {
    entries.push({
      url: `${siteUrl}/${locale}/recettes`,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: recipeListLanguages },
    });
    entries.push({
      url: `${siteUrl}/${locale}/idees`,
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: { languages: ideaLanguages },
    });
  }

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
