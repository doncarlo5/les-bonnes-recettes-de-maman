import { fetchQuery } from "convex/nextjs";
import { Suspense } from "react";
import { AdminAccessForm } from "@/components/recipes/admin-access-form";
import { AdminRecipeEditor } from "@/components/recipes/admin-recipe-editor";
import { getRecipeAdminE2EFixtures } from "@/components/recipes/admin-recipe-e2e-fixtures";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRecipeAdminAccess } from "@/lib/recipe-admin-auth";

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
  const e2eFixtures = getRecipeAdminE2EFixtures();
  const [frDictionary, enDictionary] = await Promise.all([
    getDictionary("fr"),
    getDictionary("en"),
  ]);
  const dictionaries = { fr: frDictionary, en: enDictionary };
  if (e2eFixtures) {
    const initialRecipe = initialSlug === e2eFixtures.recipe.slug ? e2eFixtures.recipe : undefined;
    return <Suspense fallback={null}><AdminRecipeEditor key={shouldCreateNew ? "new" : initialSlug ?? "home"} locale={locale} dictionaries={dictionaries} recipes={e2eFixtures.recipes} initialRecipe={initialRecipe} initialSlug={initialSlug} startInCreateMode={shouldCreateNew} /></Suspense>;
  }
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return <AdminAccessForm locale={locale} redirectTo={redirectTo} />;
  }

  const [recipes, initialRecipe] = await Promise.all([
    fetchQuery(api.recipes.listForEditing, {
      locale,
      adminPassword: adminAccess.adminPassword,
    }),
    initialSlug
      ? fetchQuery(api.recipes.getForEditing, {
          locale,
          slug: initialSlug,
          adminPassword: adminAccess.adminPassword,
        })
      : Promise.resolve(null),
  ]);

  return (
    <Suspense fallback={<main className="min-h-screen px-5 py-8"><p className="type-label text-primary">Chargement de l&apos;admin</p></main>}>
    <AdminRecipeEditor
      key={shouldCreateNew ? "new" : initialSlug ?? "home"}
      locale={locale}
      dictionaries={dictionaries}
      recipes={recipes}
      initialRecipe={initialRecipe ?? undefined}
      initialSlug={initialSlug}
      startInCreateMode={shouldCreateNew}
    />
    </Suspense>
  );
}
