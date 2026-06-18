import { Suspense } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "./types";
import { EmptyState } from "./empty-state";
import { RecipeGrid } from "./recipe-grid";
import { RecipeListExplorer } from "./recipe-list-explorer";

type RecipeListPageProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: Recipe[];
};

export function RecipeListPage({ locale, dict, recipes }: RecipeListPageProps) {
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
    <main className="px-6 py-16 lg:px-10 lg:py-20">
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <p className="eyebrow mb-3">{dict.recipeList.eyebrow}</p>
          <h1 className="font-heading text-5xl font-black leading-[0.95] tracking-tight text-foreground lg:text-7xl">
            {dict.site.title}
          </h1>
        </div>
        <Suspense
          fallback={<RecipeGrid locale={locale} dict={dict} recipes={recipes} />}
        >
          <RecipeListExplorer locale={locale} dict={dict} recipes={recipes} />
        </Suspense>
      </section>
    </main>
  );
}
