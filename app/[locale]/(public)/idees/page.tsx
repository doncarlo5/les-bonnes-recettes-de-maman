import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecipeIdeasPage } from "@/components/recipes/recipe-ideas-page";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return {
    title: dict.ideas.metadataTitle,
    description: dict.ideas.metadataDescription,
    alternates: {
      canonical: `/${locale}/idees`,
      languages: { fr: "/fr/idees", en: "/en/idees" },
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return <RecipeIdeasPage locale={locale as Locale} dict={dict} />;
}
