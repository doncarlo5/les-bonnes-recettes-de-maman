import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "./types";
import { EmptyState } from "./empty-state";

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
    <main className="min-h-screen bg-pale-amber-50 px-5 py-8 text-soft-peach-950">
      <section className="mx-auto w-full max-w-md">
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-soft-peach-600">
            {dict.recipeList.eyebrow}
          </p>
          <h1 className="font-heading text-5xl font-bold leading-[0.95] text-stone-950">
            {dict.site.title}
          </h1>
        </div>

        <div className="space-y-4">
          {recipes.map((recipe) => (
            <Link
              key={recipe._id}
              href={`/${locale}/recettes/${recipe.slug}`}
              className="group grid w-full grid-cols-[6.5rem_1fr] overflow-hidden rounded-lg bg-white text-left shadow-sm ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-peach-500"
            >
              <span className="relative min-h-32 overflow-hidden">
                <Image
                  src={recipe.heroImageUrl}
                  alt=""
                  fill
                  sizes="104px"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              </span>
              <span className="flex min-w-0 flex-col justify-between gap-4 p-4">
                <span>
                  <span className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-stone-400">
                    <Clock3 className="size-3.5" />
                    {recipe.totalMinutes} min.
                  </span>
                  <span className="block font-heading text-3xl font-bold leading-none text-stone-950">
                    {recipe.title}
                  </span>
                </span>
                <span className="line-clamp-2 text-sm leading-6 text-stone-500">
                  {recipe.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
