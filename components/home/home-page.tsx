import { Suspense } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { RecipeSummary } from "@/components/recipes/types";
import { RecipeGrid } from "@/components/recipes/recipe-grid";
import { RecipeListExplorer } from "@/components/recipes/recipe-list-explorer";

type HomePageProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: RecipeSummary[];
};

export function HomePage({ locale, dict, recipes }: HomePageProps) {
  return (
    <main>
      <h1 className="sr-only">{dict.site.title}</h1>

      <section id="recettes" className="scroll-mt-24 bg-muted/55 px-3 py-3 md:px-5 md:py-5 lg:px-10 lg:py-6">
        <div className="mx-auto max-w-7xl">
          <h2 className="sr-only">{dict.home.allRecipesTitle}</h2>
          <Suspense fallback={<RecipeGrid locale={locale} dict={dict} recipes={recipes} />}>
            <RecipeListExplorer locale={locale} dict={dict} recipes={recipes} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
