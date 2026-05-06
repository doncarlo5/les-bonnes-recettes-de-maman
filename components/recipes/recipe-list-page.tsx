import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "./types";
import { EmptyState } from "./empty-state";

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

type RecipeGridProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: Recipe[];
  /** First card spans full width as a featured tile. */
  featureFirst?: boolean;
};

export function RecipeGrid({
  locale,
  dict,
  recipes,
  featureFirst = true,
}: RecipeGridProps) {
  if (recipes.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
      {recipes.map((recipe, index) => {
        const isFeatured = featureFirst && index === 0;
        return (
          <li
            key={recipe._id}
            className={isFeatured ? "md:col-span-2" : undefined}
          >
            <Link
              href={`/${locale}/recettes/${recipe.slug}`}
              className={`group relative block w-full overflow-hidden rounded-xl bg-stone-900 text-left ring-1 ring-black/5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-peach-500 ${
                isFeatured ? "h-[26rem] lg:h-[30rem]" : "h-72 lg:h-80"
              }`}
            >
              <span className="absolute inset-0 overflow-hidden">
                <Image
                  src={recipe.heroImageUrl || defaultRecipeImageUrl}
                  alt=""
                  fill
                  sizes={
                    isFeatured
                      ? "(max-width: 1024px) 100vw, 1100px"
                      : "(max-width: 768px) 100vw, 540px"
                  }
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              </span>
              <span className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/15 to-black/65" />
              <span className="absolute inset-x-0 bottom-0 block px-7 pb-7 text-white sm:px-9 sm:pb-9">
                <span className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-soft-peach-200/90">
                  <Clock3 className="size-4 stroke-[1.8]" />
                  {recipe.timeLabel}
                </span>
                <span
                  className={`block max-w-[18ch] font-heading font-black leading-[0.95] text-white drop-shadow-sm ${
                    isFeatured ? "text-5xl lg:text-7xl" : "text-4xl lg:text-5xl"
                  }`}
                >
                  {recipe.title}
                </span>
                <span className="mt-3 block font-heading text-lg italic text-white/80">
                  {dict.recipeDetail.recipeBy} {recipe.author}
                </span>
              </span>
              <span
                aria-hidden
                className="absolute inset-x-9 bottom-0 h-px origin-center scale-x-0 bg-soft-peach-300 transition duration-500 group-hover:scale-x-100"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

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
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-soft-peach-700">
            {dict.recipeList.eyebrow}
          </p>
          <h1 className="font-heading text-5xl font-black leading-[0.95] tracking-tight text-stone-950 lg:text-7xl">
            {dict.site.title}
          </h1>
        </div>
        <RecipeGrid locale={locale} dict={dict} recipes={recipes} />
      </section>
    </main>
  );
}
