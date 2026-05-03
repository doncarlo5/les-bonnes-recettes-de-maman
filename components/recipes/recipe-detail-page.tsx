import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Clock3 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Ingredient, Recipe } from "./types";

type RecipeDetailPageProps = {
  locale: Locale;
  dict: Dictionary;
  recipe: Recipe;
};

export function RecipeDetailPage({
  locale,
  dict,
  recipe,
}: RecipeDetailPageProps) {
  return (
    <main className="min-h-screen bg-white text-stone-700">
      <article className="mx-auto min-h-screen w-full max-w-md bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
        <header className="relative min-h-[34rem] overflow-hidden bg-stone-900">
          <Image
            src={recipe.heroImageUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 448px) 100vw, 448px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/55" />

          <Link
            href={`/${locale}`}
            aria-label={dict.recipeDetail.backToList}
            className="absolute left-6 top-8 z-10 flex size-10 items-center justify-center rounded-full text-white/95 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="size-8 stroke-[1.7]" />
          </Link>

          <div className="absolute inset-x-0 bottom-0 px-7 pb-7 text-white">
            <div className="mb-4 flex items-center gap-2 text-lg font-extrabold text-white/75">
              <Clock3 className="size-6" />
              <span>{recipe.totalMinutes} min.</span>
            </div>
            <h1 className="font-heading text-6xl font-black leading-[0.86] tracking-normal drop-shadow-sm">
              {recipe.title}
            </h1>
            <p className="mt-4 text-lg font-extrabold italic text-white/75">
              {dict.recipeDetail.recipeBy} {recipe.author}
            </p>
          </div>
        </header>

        <div className="px-8 py-9">
          <p className="text-[1.35rem] font-semibold leading-[1.9] text-stone-400">
            {recipe.description}
          </p>

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-3xl font-bold text-stone-950">
                {dict.recipeDetail.ingredients}
              </h2>
              <p className="rounded-full bg-pale-amber-100 px-3 py-1 text-sm font-extrabold text-pale-amber-800">
                {recipe.servings.quantity} {recipe.servings.unit}
              </p>
            </div>
            <ul className="divide-y divide-stone-100">
              {recipe.ingredients.map((ingredient) => (
                <li
                  key={`${ingredient.name}-${ingredient.unit ?? ""}`}
                  className="flex items-baseline justify-between gap-4 py-3 text-base"
                >
                  <span className="font-bold text-stone-700">
                    {ingredient.name}
                  </span>
                  <span className="shrink-0 font-extrabold text-stone-400">
                    {formatQuantity(ingredient)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10 space-y-7">
            {recipe.sections.map((section) => (
              <div key={section.title}>
                <h2 className="mb-3 font-heading text-3xl font-bold text-stone-950">
                  {section.title}
                </h2>
                <ol className="space-y-3">
                  {section.steps.map((step, index) => (
                    <li
                      key={step}
                      className="grid grid-cols-[2rem_1fr] gap-3 text-base leading-7 text-stone-500"
                    >
                      <span className="mt-1 flex size-8 items-center justify-center rounded-full bg-soft-peach-100 text-sm font-black text-soft-peach-700">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        </div>
      </article>
    </main>
  );
}

function formatQuantity(ingredient: Ingredient) {
  if (!ingredient.quantity) return "";
  return `${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;
}
