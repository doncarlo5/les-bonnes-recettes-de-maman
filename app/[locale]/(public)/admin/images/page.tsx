import { fetchQuery } from "convex/nextjs";
import { AdminImageUpload } from "@/components/recipes/admin-image-upload";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/config";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  const recipes = await fetchQuery(api.recipes.list, { locale });

  return <AdminImageUpload locale={locale} recipes={recipes} />;
}
