import { Suspense } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "@/components/recipes/types";
import { RecipeGrid } from "@/components/recipes/recipe-grid";
import { RecipeListExplorer } from "@/components/recipes/recipe-list-explorer";

type HomePageProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: Recipe[];
};

export function HomePage({ locale, dict, recipes }: HomePageProps) {
  return (
    <main>
      <section className="relative overflow-hidden px-5 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-border" />
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)] lg:items-end">
          <div>
          <p className="type-label mb-5 text-primary">{dict.home.eyebrow}</p>
          <h1 className="type-display text-foreground">
            {dict.site.title}
          </h1>
          </div>
          <p className="type-editorial-lead text-foreground/75 lg:pb-2">
            {dict.home.lead}
          </p>
        </div>
      </section>

      <section id="recettes" className="scroll-mt-24 bg-muted/55 px-5 py-16 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-end justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="type-label mb-2 text-primary">{dict.home.allRecipesEyebrow}</p>
              <h2 className="type-section-title text-foreground">
                {dict.home.allRecipesTitle}
              </h2>
            </div>
          </div>
          <Suspense fallback={<RecipeGrid locale={locale} dict={dict} recipes={recipes} />}>
            <RecipeListExplorer locale={locale} dict={dict} recipes={recipes} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
