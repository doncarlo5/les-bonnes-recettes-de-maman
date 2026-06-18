import { fetchQuery } from "convex/nextjs";
import { AdminAccessForm } from "@/components/recipes/admin-access-form";
import { AdminRecipeEditor } from "@/components/recipes/admin-recipe-editor";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/config";
import { hasRecipeAdminAccess } from "@/lib/recipe-admin-auth";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
  searchParams: Promise<{
    new?: string | string[];
    slug?: string | string[];
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { new: newRecipe, slug } = await searchParams;
  const shouldCreateNew = Array.isArray(newRecipe)
    ? newRecipe.includes("1")
    : newRecipe === "1";
  const initialSlug = shouldCreateNew
    ? undefined
    : Array.isArray(slug)
      ? slug[0]
      : slug;
  const redirectTo = shouldCreateNew
    ? `/${locale}/admin/recettes?new=1`
    : initialSlug
      ? `/${locale}/admin/recettes?slug=${encodeURIComponent(initialSlug)}`
      : `/${locale}/admin/recettes`;
  const hasAdminAccess = await hasRecipeAdminAccess();

  if (!hasAdminAccess) {
    return <AdminAccessForm locale={locale} redirectTo={redirectTo} />;
  }

  const recipes = await fetchQuery(api.recipes.listForEditing, { locale });

  return (
    <AdminRecipeEditor
      locale={locale}
      recipes={recipes}
      initialSlug={initialSlug}
      startInCreateMode={shouldCreateNew}
    />
  );
}
