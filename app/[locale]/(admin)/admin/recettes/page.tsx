import { fetchQuery } from "convex/nextjs";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminAccessForm } from "@/components/recipes/admin-access-form";
import { AdminRecipeEditor } from "@/components/recipes/admin-recipe-editor";
import { AdminRecipeIdeas } from "@/components/recipes/admin-recipe-ideas";
import { getRecipeAdminE2EFixtures } from "@/components/recipes/admin-recipe-e2e-fixtures";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getRecipeAdminAccess } from "@/lib/recipe-admin-auth";
import type { EditableRecipeSummary } from "@/components/recipes/types";
import { collectPaginated } from "@/lib/convex-pagination";
import {
  getAdminRecipeIdea,
  getAdminRecipeIdeaCount,
} from "@/lib/recipe-idea-admin-client";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
  searchParams: Promise<{
    new?: string | string[];
    slug?: string | string[];
    section?: string | string[];
    lang?: string | string[];
    field?: string | string[];
    mode?: string | string[];
    view?: string | string[];
    newIdea?: string | string[];
    idea?: string | string[];
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const { new: newRecipe, slug, section, view, newIdea, idea } = resolvedSearchParams;
  const requestedView = Array.isArray(view) ? view[0] : view;
  const sourceIdeaId = (Array.isArray(idea) ? idea[0] : idea)?.trim() || undefined;
  const requestedSection = Array.isArray(section) ? section[0] : section;
  if (requestedSection === "photo" || requestedSection === "essentials") {
    const canonicalParams = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        canonicalParams.append(key, item);
      }
    }
    canonicalParams.set("section", "info");
    redirect(`/${locale}/admin/recettes?${canonicalParams.toString()}`);
  }
  const shouldCreateNew = Array.isArray(newRecipe)
    ? newRecipe.includes("1")
    : newRecipe === "1";
  const initialSlug = shouldCreateNew
    ? undefined
    : Array.isArray(slug)
      ? slug[0]
      : slug;
  const redirectTo = requestedView === "ideas"
    ? `/${locale}/admin/recettes?view=ideas${(Array.isArray(newIdea) ? newIdea.includes("1") : newIdea === "1") ? "&newIdea=1" : ""}`
    : shouldCreateNew
    ? `/${locale}/admin/recettes?new=1${sourceIdeaId ? `&idea=${encodeURIComponent(sourceIdeaId)}` : ""}`
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
    if (requestedView === "ideas") {
      return (
        <AdminRecipeIdeas
          locale={locale}
          dict={dictionaries[locale]}
          initialCount={1}
          startWithComposer={Array.isArray(newIdea) ? newIdea.includes("1") : newIdea === "1"}
        />
      );
    }
    const initialRecipe = initialSlug === e2eFixtures.recipe.slug ? e2eFixtures.recipe : undefined;
    const sourceIdea = sourceIdeaId === e2eFixtures.idea._id
      ? e2eFixtures.idea
      : undefined;
    return <Suspense fallback={null}><AdminRecipeEditor key={shouldCreateNew ? "new" : initialSlug ?? "home"} locale={locale} dictionaries={dictionaries} recipes={e2eFixtures.recipes} initialRecipe={initialRecipe} initialSlug={initialSlug} startInCreateMode={shouldCreateNew} ideaCount={0} sourceIdea={sourceIdea} /></Suspense>;
  }
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return <AdminAccessForm locale={locale} redirectTo={redirectTo} />;
  }

  if (requestedView === "ideas") {
    const ideaCount = await getAdminRecipeIdeaCount(adminAccess.adminPassword);
    return (
      <AdminRecipeIdeas
        locale={locale}
        dict={dictionaries[locale]}
        initialCount={ideaCount}
        startWithComposer={Array.isArray(newIdea) ? newIdea.includes("1") : newIdea === "1"}
      />
    );
  }

  const [recipes, initialRecipe, ideaCount, sourceIdea] = await Promise.all([
    listAllRecipesForEditing(locale, adminAccess.adminPassword),
    initialSlug
      ? fetchQuery(api.recipes.getForEditing, {
          locale,
          slug: initialSlug,
          adminPassword: adminAccess.adminPassword,
        })
      : Promise.resolve(null),
    getAdminRecipeIdeaCount(adminAccess.adminPassword),
    sourceIdeaId
      ? getAdminRecipeIdea(adminAccess.adminPassword, sourceIdeaId, locale)
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
      ideaCount={ideaCount}
      sourceIdea={sourceIdea ?? undefined}
    />
    </Suspense>
  );
}

async function listAllRecipesForEditing(
  locale: Locale,
  adminPassword: string,
) {
  const recipes = await collectPaginated<EditableRecipeSummary>((cursor) =>
    fetchQuery(api.recipes.listForEditing, {
      locale,
      adminPassword,
      paginationOpts: { numItems: 50, cursor },
    }),
  );
  return recipes.sort((a, b) => b.updatedAt - a.updatedAt);
}
