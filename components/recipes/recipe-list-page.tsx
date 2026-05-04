import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "./types";
import { EmptyState } from "./empty-state";

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

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
    <main className="min-h-screen bg-pale-amber-50 px-4 py-7 text-soft-peach-950 sm:px-6">
      <section className="mx-auto w-full max-w-2xl">
        <div className="mb-7 px-1">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-soft-peach-600">
            {dict.recipeList.eyebrow}
          </p>
          <h1 className="max-w-xl font-heading text-5xl font-black leading-[0.92] text-stone-950 sm:text-6xl">
            {dict.site.title}
          </h1>
        </div>

        <div className="space-y-5">
          {recipes.map((recipe) => (
            <Link
              key={recipe._id}
              href={`/${locale}/recettes/${recipe.slug}`}
              className="group relative block h-72 w-full overflow-hidden rounded-sm bg-stone-900 text-left shadow-sm ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-peach-500 sm:h-80"
            >
              <span className="absolute inset-0 overflow-hidden">
                <Image
                  src={recipe.heroImageUrl || defaultRecipeImageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 672px) 100vw, 672px"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </span>
              <span className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/55" />
              <span className="absolute inset-x-0 bottom-0 block px-7 pb-7 text-white sm:px-9 sm:pb-8">
                <span className="mb-3 inline-flex items-center gap-2 text-lg font-black text-white/75">
                  <Clock3 className="size-5 stroke-[1.7]" />
                  {recipe.timeLabel}
                </span>
                <span className="block max-w-[13ch] font-heading text-5xl font-black leading-[0.9] text-white drop-shadow-sm sm:text-6xl">
                  {recipe.title}
                </span>
                <span className="mt-3 block text-lg font-extrabold italic text-white/75">
                  {dict.recipeDetail.recipeBy} {recipe.author}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
