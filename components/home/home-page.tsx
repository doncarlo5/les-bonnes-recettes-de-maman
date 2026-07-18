import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "@/components/recipes/types";
import { RecipeGrid } from "@/components/recipes/recipe-grid";
import { EmptyState } from "@/components/recipes/empty-state";

type HomePageProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: Recipe[];
};

export function HomePage({ locale, dict, recipes }: HomePageProps) {
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
    <main>
      {/* Editorial hero */}
      <section className="relative overflow-hidden bg-muted px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="type-label mb-6 text-primary">{dict.home.eyebrow}</p>
          <h1 className="type-display text-foreground">
            {dict.site.title}
          </h1>
          <div aria-hidden className="mx-auto my-8 h-px w-16 bg-border" />
          <p className="type-editorial-lead mx-auto text-foreground/80">
            {dict.home.lead}
          </p>
        </div>
      </section>

      {/* All recipes grid */}
      <section className="bg-muted px-6 py-24 lg:px-10 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-baseline justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="type-label mb-2 text-primary">{dict.home.allRecipesEyebrow}</p>
              <h2 className="type-section-title text-foreground">
                {dict.home.allRecipesTitle}
              </h2>
            </div>
          </div>
          <RecipeGrid locale={locale} dict={dict} recipes={recipes} />
        </div>
      </section>
    </main>
  );
}
