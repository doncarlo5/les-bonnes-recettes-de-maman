import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "@/components/recipes/types";
import { RecipeGrid } from "@/components/recipes/recipe-list-page";
import { EmptyState } from "@/components/recipes/empty-state";

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

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

  const [featured, ...rest] = recipes;

  return (
    <main>
      {/* Editorial hero */}
      <section className="relative overflow-hidden bg-muted px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow mb-6">{dict.home.eyebrow}</p>
          <h1 className="font-heading text-display text-foreground">
            {dict.site.title}
          </h1>
          <div aria-hidden className="mx-auto my-8 h-px w-16 bg-border" />
          <p className="mx-auto max-w-2xl font-heading text-xl italic leading-relaxed text-foreground/80 sm:text-2xl">
            {dict.home.lead}
          </p>
        </div>
      </section>

      {/* Featured recipe */}
      <section className="px-6 pb-20 lg:px-10 lg:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-baseline justify-between gap-4 border-b border-border pb-4">
            <p className="eyebrow">{dict.home.featuredEyebrow}</p>
          </div>
          <Link
            href={`/${locale}/recettes/${featured.slug}`}
            className="group grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-14"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-muted shadow-card transition duration-300 group-hover:shadow-card-hover sm:aspect-[5/4] lg:aspect-[4/5]">
              <Image
                src={featured.heroImageUrl || defaultRecipeImageUrl}
                alt={featured.imageCredit?.alt ?? ""}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 700px"
                className="object-cover transition duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <div className="lg:pr-6">
              <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
                <Clock3 className="size-4 stroke-[1.8]" />
                {featured.timeLabel}
              </p>
              <h2 className="font-heading text-5xl font-black leading-[0.95] tracking-tight text-foreground lg:text-6xl">
                {featured.title}
              </h2>
              <p className="mt-3 font-heading text-lg italic text-muted-foreground">
                {dict.recipeDetail.recipeBy} {featured.author}
              </p>
              {featured.description ? (
                <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-foreground/80">
                  {featured.description}
                </p>
              ) : null}
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-primary transition group-hover:gap-3">
                {dict.home.featuredCta}
                <ArrowRight className="size-4 stroke-[2]" />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* All recipes grid */}
      {rest.length > 0 ? (
        <section className="bg-muted px-6 py-24 lg:px-10 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex items-baseline justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="eyebrow mb-2">{dict.home.allRecipesEyebrow}</p>
                <h2 className="font-heading text-section text-foreground">
                  {dict.home.allRecipesTitle}
                </h2>
              </div>
            </div>
            <RecipeGrid
              locale={locale}
              dict={dict}
              recipes={rest}
              featureFirst={false}
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}
