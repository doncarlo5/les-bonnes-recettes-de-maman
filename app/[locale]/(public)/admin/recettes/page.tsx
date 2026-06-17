import { fetchQuery } from "convex/nextjs";
import { AdminRecipeEditor } from "@/components/recipes/admin-recipe-editor";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/config";
import { updateRecipeAction } from "./actions";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
  searchParams: Promise<{
    slug?: string | string[];
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { slug } = await searchParams;
  const recipes = await fetchQuery(api.recipes.listForEditing, { locale });
  const initialSlug = Array.isArray(slug) ? slug[0] : slug;

  return (
    <AdminRecipeEditor
      locale={locale}
      recipes={recipes}
      initialSlug={initialSlug}
      action={updateRecipeAction}
    />
  );
}
