import { Suspense } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { RecipeSummary } from "./types";
import { EmptyState } from "./empty-state";
import { RecipeGrid } from "./recipe-grid";
import { RecipeListExplorer } from "./recipe-list-explorer";

type RecipeListPageProps = {
  locale: Locale;
  dict: Dictionary;
  hasInitialFilters?: boolean;
  recipes: RecipeSummary[];
};

export function RecipeListPage({
  locale,
  dict,
  hasInitialFilters = false,
  recipes,
}: RecipeListPageProps) {
  if (recipes.length === 0) {
    return (
      <EmptyState
        eyebrow={dict.recipeList.eyebrow}
        title={dict.site.title}
        description={dict.recipeList.emptyDescription}
      />
    );
  }

  return (
    <main className="px-3 py-3 md:px-6 md:py-16 lg:px-10 lg:py-20">
      <section className="mx-auto w-full max-w-6xl">
        <div className="sr-only md:not-sr-only md:mb-12 md:block md:max-w-2xl">
          <p className="type-label mb-3 text-primary">{dict.recipeList.eyebrow}</p>
          <h1 className="type-page-title text-foreground">
            {dict.site.title}
          </h1>
        </div>
        <Suspense
          fallback={
            <RecipeGrid
              locale={locale}
              dict={dict}
              recipes={recipes}
              showAddRecipeCard={!hasInitialFilters}
            />
          }
        >
          <RecipeListExplorer locale={locale} dict={dict} recipes={recipes} />
        </Suspense>
      </section>
    </main>
  );
}
