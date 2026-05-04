import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Clock3 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Ingredient, Recipe } from "./types";

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

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
      <article className="mx-auto min-h-screen w-full max-w-2xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
        <header className="relative min-h-[31rem] overflow-hidden bg-stone-900 sm:min-h-[36rem]">
          <Image
            src={recipe.heroImageUrl || defaultRecipeImageUrl}
            alt={recipe.imageCredit?.alt ?? ""}
            fill
            priority
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/52" />

          <Link
            href={`/${locale}`}
            aria-label={dict.recipeDetail.backToList}
            className="absolute left-6 top-7 z-10 flex size-11 items-center justify-center text-white/95 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="size-9 stroke-[1.55]" />
          </Link>

          {recipe.imageCredit ? (
            <p className="absolute right-6 top-8 z-10 text-right text-[0.7rem] font-bold text-white/70">
              Photo{" "}
              <a
                href={recipe.imageCredit.photographerUrl}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:text-white hover:underline"
              >
                {recipe.imageCredit.photographerName}
              </a>{" "}
              /{" "}
              <a
                href={recipe.imageCredit.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:text-white hover:underline"
              >
                Unsplash
              </a>
            </p>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 px-8 pb-8 text-white sm:px-10 sm:pb-10">
            <div className="mb-4 flex items-center gap-2 text-xl font-black text-white/75">
              <Clock3 className="size-7 stroke-[1.6]" />
              <span>{recipe.timeLabel}</span>
            </div>
            <h1 className="max-w-[11ch] font-heading text-[4.7rem] font-black leading-[0.88] tracking-normal drop-shadow-sm sm:text-[6.25rem]">
              {recipe.title}
            </h1>
            <p className="mt-4 text-2xl font-extrabold italic leading-none text-white/75">
              {dict.recipeDetail.recipeBy} {recipe.author}
            </p>
          </div>
        </header>

        <div className="px-9 py-12 sm:px-12 sm:py-14">
          <p className="text-[1.85rem] font-semibold leading-[1.85] text-stone-400 sm:text-[2.1rem]">
            {recipe.description}
          </p>

          <RecipeMeta dict={dict} recipe={recipe} />

          <section className="mt-12">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="font-heading text-4xl font-black text-stone-950">
                {dict.recipeDetail.ingredients}
              </h2>
              {recipe.servings ? (
                <p className="shrink-0 rounded-full bg-pale-amber-100 px-4 py-1.5 text-sm font-black text-pale-amber-800">
                  {recipe.servings.quantity} {recipe.servings.unit}
                </p>
              ) : null}
            </div>
            <ul className="divide-y divide-stone-100">
              {recipe.ingredients.map((ingredient, index) => (
                <li
                  key={`${ingredient.name}-${ingredient.unit}-${index}`}
                  className="flex items-baseline justify-between gap-5 py-3.5 text-lg"
                >
                  <span className="font-bold text-stone-700">
                    {ingredient.name}
                    {ingredient.notes ? (
                      <span className="mt-1 block text-sm font-semibold text-stone-400">
                        {ingredient.notes}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-black text-stone-400">
                    {formatQuantity(ingredient)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12 space-y-9">
            {recipe.sections.map((section) => (
              <div key={section.title}>
                <h2 className="mb-4 font-heading text-4xl font-black text-stone-950">
                  {section.title}
                </h2>
                <ol className="space-y-4">
                  {section.steps.map((step, index) => (
                    <li
                      key={step}
                      className="grid grid-cols-[2.25rem_1fr] gap-4 text-lg font-semibold leading-8 text-stone-400"
                    >
                      <span className="mt-1 flex size-9 items-center justify-center rounded-full bg-soft-peach-100 text-sm font-black text-soft-peach-700">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>

          {recipe.subRecipes.length > 0 ? (
            <section className="mt-12 space-y-6">
              <h2 className="font-heading text-4xl font-black text-stone-950">
                {dict.recipeDetail.subRecipes}
              </h2>
              {recipe.subRecipes.map((subRecipe) => (
                <div key={subRecipe.title}>
                  <h3 className="mb-2 text-lg font-black text-stone-700">
                    {subRecipe.title}
                  </h3>
                  <ul className="divide-y divide-stone-100">
                    {subRecipe.ingredients.map((ingredient, index) => (
                      <li
                        key={`${subRecipe.title}-${ingredient.name}-${ingredient.unit}-${index}`}
                        className="flex items-baseline justify-between gap-5 py-3.5 text-lg"
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
                </div>
              ))}
            </section>
          ) : null}

          {recipe.notes.length > 0 ? (
            <section className="mt-12">
              <h2 className="mb-4 font-heading text-4xl font-black text-stone-950">
                {dict.recipeDetail.notes}
              </h2>
              <ul className="space-y-3 text-lg font-semibold leading-8 text-stone-400">
                {recipe.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </article>
    </main>
  );
}

function RecipeMeta({
  dict,
  recipe,
}: {
  dict: Dictionary;
  recipe: Recipe;
}) {
  const meta = [
    [dict.recipeDetail.prepTime, recipe.prepTime],
    [dict.recipeDetail.cookTime, recipe.cookTime],
    [dict.recipeDetail.totalTime, recipe.totalTime],
    [dict.recipeDetail.temperature, recipe.temperature],
  ].filter(([, value]) => value);

  if (meta.length === 0) return null;

  return (
    <dl className="mt-10 grid grid-cols-2 gap-x-7 gap-y-5 border-y border-stone-100 py-7">
      {meta.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-black uppercase tracking-[0.18em] text-soft-peach-600">
            {label}
          </dt>
          <dd className="mt-1 text-lg font-black text-stone-500">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatQuantity(ingredient: Ingredient) {
  if (!ingredient.quantity) return "";
  return `${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;
}
