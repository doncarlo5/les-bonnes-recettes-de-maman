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
    slug?: string | string[];
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { slug } = await searchParams;
  const hasAdminAccess = await hasRecipeAdminAccess();

  if (!hasAdminAccess) {
    return <AdminAccessForm locale={locale} />;
  }

  const recipes = await fetchQuery(api.recipes.listForEditing, { locale });
  const initialSlug = Array.isArray(slug) ? slug[0] : slug;

  return (
    <AdminRecipeEditor
      locale={locale}
      recipes={recipes}
      initialSlug={initialSlug}
    />
  );
}
