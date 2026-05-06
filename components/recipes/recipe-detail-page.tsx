"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Clock3 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
    <main className="text-stone-700">
      {/* Full-bleed hero */}
      <header className="relative h-[58vh] min-h-[22rem] w-full overflow-hidden bg-stone-900 lg:h-[80vh] lg:min-h-[42rem]">
        <Image
          src={recipe.heroImageUrl || defaultRecipeImageUrl}
          alt={recipe.imageCredit?.alt ?? ""}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/70" />

        <Link
          href={`/${locale}`}
          aria-label={dict.recipeDetail.backToList}
          className="absolute left-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:left-10 lg:top-8 lg:size-11"
        >
          <ChevronLeft className="size-6 stroke-[1.8]" />
        </Link>

        {recipe.imageCredit ? (
          <p className="absolute right-4 top-5 z-10 text-right text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/70 lg:right-10 lg:top-8 lg:text-[0.7rem] lg:tracking-[0.18em]">
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

        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto w-full max-w-6xl px-4 pb-6 text-white sm:pb-10 lg:px-10 lg:pb-20">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/85 lg:mb-5 lg:text-sm lg:tracking-[0.22em]">
              <Clock3 className="size-4 stroke-[1.8]" />
              <span>{recipe.timeLabel}</span>
            </div>
            <h1 className="max-w-[14ch] font-heading text-4xl font-black leading-[0.95] tracking-tight drop-shadow-sm sm:text-6xl lg:text-[8rem] lg:leading-[0.9]">
              {recipe.title}
            </h1>
            <p className="mt-3 font-heading text-lg italic text-white/80 lg:mt-5 lg:text-3xl">
              {dict.recipeDetail.recipeBy} {recipe.author}
            </p>
          </div>
        </div>
      </header>

      {/* Lead description */}
      {recipe.description ? (
        <section className="bg-pale-blue-50 px-4 py-10 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-heading text-lg italic leading-relaxed text-pale-blue-800 sm:text-2xl lg:text-3xl">
              {recipe.description}
            </p>
            <div
              aria-hidden
              className="mx-auto mt-6 h-px w-16 bg-pale-blue-300 lg:mt-10"
            />
          </div>
        </section>
      ) : null}

      {/* Body: instructions + sticky ingredients sidebar */}
      <section className="px-4 pb-16 lg:px-10 lg:pb-32">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_22rem] lg:gap-16">
          <div className="min-w-0">
            <RecipeMeta dict={dict} recipe={recipe} />

            <div className="mt-8 space-y-8 lg:mt-14 lg:space-y-12">
              {recipe.sections.map((section) => (
                <div key={section.title}>
                  <h2 className="mb-4 font-heading text-2xl font-black tracking-tight text-stone-950 lg:mb-6 lg:text-3xl xl:text-4xl">
                    {section.title}
                  </h2>
                  <ol className="space-y-4 lg:space-y-6">
                    {section.steps.map((step, index) => (
                      <li
                        key={step}
                        className="grid grid-cols-[2rem_1fr] gap-3 text-base leading-7 text-stone-700 lg:grid-cols-[2.5rem_1fr] lg:gap-5 lg:text-lg lg:leading-[1.8]"
                      >
                        <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-soft-peach-100 font-heading text-sm font-black text-soft-peach-700 lg:mt-1 lg:size-9 lg:text-base">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            {recipe.subRecipes.length > 0 ? (
              <>
                {/* Mobile: accordion */}
                <div className="mt-8 lg:hidden">
                  <h2 className="mb-3 font-heading text-2xl font-black tracking-tight text-stone-950">
                    {dict.recipeDetail.subRecipes}
                  </h2>
                  <Accordion
                    className="border-t border-stone-200"
                    defaultValue={recipe.subRecipes[0]?.title}
                  >
                    {recipe.subRecipes.map((subRecipe) => (
                      <AccordionItem
                        key={subRecipe.title}
                        value={subRecipe.title}
                      >
                        <AccordionTrigger className="font-heading text-lg font-black text-stone-800">
                          {subRecipe.title}
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="divide-y divide-stone-200">
                            {subRecipe.ingredients.map((ingredient, index) => (
                              <li
                                key={`${subRecipe.title}-${ingredient.name}-${ingredient.unit}-${index}`}
                                className="flex items-baseline justify-between gap-4 py-2.5 text-sm"
                              >
                                <span className="font-semibold text-stone-700">
                                  {ingredient.name}
                                </span>
                                <span className="shrink-0 font-bold text-stone-500">
                                  {formatQuantity(ingredient)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>

                {/* Desktop: stacked */}
                <div className="mt-14 hidden space-y-8 lg:block">
                  <h2 className="font-heading text-3xl font-black tracking-tight text-stone-950 lg:text-4xl">
                    {dict.recipeDetail.subRecipes}
                  </h2>
                  {recipe.subRecipes.map((subRecipe) => (
                    <div key={subRecipe.title}>
                      <h3 className="mb-3 font-heading text-xl font-black text-stone-800">
                        {subRecipe.title}
                      </h3>
                      <ul className="divide-y divide-stone-200">
                        {subRecipe.ingredients.map((ingredient, index) => (
                          <li
                            key={`${subRecipe.title}-${ingredient.name}-${ingredient.unit}-${index}`}
                            className="flex items-baseline justify-between gap-5 py-3 text-base"
                          >
                            <span className="font-semibold text-stone-700">
                              {ingredient.name}
                            </span>
                            <span className="shrink-0 font-bold text-stone-500">
                              {formatQuantity(ingredient)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {recipe.notes.length > 0 ? (
              <>
                {/* Mobile: collapsed accordion */}
                <div className="mt-8 lg:hidden">
                  <Accordion>
                    <AccordionItem value="notes" className="border-t border-stone-200">
                      <AccordionTrigger className="font-heading text-2xl font-black tracking-tight text-stone-950">
                        {dict.recipeDetail.notes}
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2 text-base leading-7 text-stone-600">
                          {recipe.notes.map((note) => (
                            <li
                              key={note}
                              className="border-l-2 border-soft-peach-300 pl-4 italic"
                            >
                              {note}
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Desktop */}
                <div className="mt-14 hidden lg:block">
                  <h2 className="mb-5 font-heading text-3xl font-black tracking-tight text-stone-950 lg:text-4xl">
                    {dict.recipeDetail.notes}
                  </h2>
                  <ul className="space-y-3 text-lg leading-[1.8] text-stone-600">
                    {recipe.notes.map((note) => (
                      <li
                        key={note}
                        className="border-l-2 border-soft-peach-300 pl-5 italic"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
          </div>

          {/* Sidebar — ingredients */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            {/* Mobile: collapsible card */}
            <div className="lg:hidden">
              <div className="rounded-xl bg-pale-blue-50 px-4 ring-1 ring-pale-blue-200/70">
                <Accordion defaultValue="ingredients">
                  <AccordionItem value="ingredients">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                        <span className="font-heading text-2xl font-black tracking-tight text-stone-950">
                          {dict.recipeDetail.ingredients}
                        </span>
                        {recipe.servings ? (
                          <span className="shrink-0 rounded-full bg-pale-blue-200/80 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-pale-blue-800">
                            {recipe.servings.quantity} {recipe.servings.unit}
                          </span>
                        ) : null}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="divide-y divide-pale-blue-200/70 border-t border-pale-blue-200/70">
                        {recipe.ingredients.map((ingredient, index) => (
                          <li
                            key={`${ingredient.name}-${ingredient.unit}-${index}`}
                            className="flex items-baseline justify-between gap-3 py-2 text-sm"
                          >
                            <span className="font-semibold text-stone-800">
                              {ingredient.name}
                              {ingredient.notes ? (
                                <span className="mt-0.5 block text-xs font-medium italic text-stone-500">
                                  {ingredient.notes}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-bold text-stone-600">
                              {formatQuantity(ingredient)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>

            {/* Desktop: original card */}
            <div className="hidden rounded-2xl bg-pale-blue-50 p-7 ring-1 ring-pale-blue-200/70 lg:block lg:p-8">
              <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-pale-blue-200/80 pb-4">
                <h2 className="font-heading text-3xl font-black tracking-tight text-stone-950">
                  {dict.recipeDetail.ingredients}
                </h2>
                {recipe.servings ? (
                  <span className="shrink-0 rounded-full bg-pale-blue-200/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-pale-blue-800">
                    {recipe.servings.quantity} {recipe.servings.unit}
                  </span>
                ) : null}
              </div>
              <ul className="divide-y divide-pale-blue-200/70">
                {recipe.ingredients.map((ingredient, index) => (
                  <li
                    key={`${ingredient.name}-${ingredient.unit}-${index}`}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <span className="font-semibold text-stone-800">
                      {ingredient.name}
                      {ingredient.notes ? (
                        <span className="mt-0.5 block text-sm font-medium italic text-stone-500">
                          {ingredient.notes}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-bold text-stone-600">
                      {formatQuantity(ingredient)}
                    </span>
                  </li>
                ))}
              </ul>
              {recipe.totalTime ? (
                <p className="mt-6 border-t border-pale-blue-200/80 pt-4 text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                  {dict.recipeDetail.totalTime} · {recipe.totalTime}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function RecipeMeta({ dict, recipe }: { dict: Dictionary; recipe: Recipe }) {
  const meta = [
    [dict.recipeDetail.prepTime, recipe.prepTime],
    [dict.recipeDetail.cookTime, recipe.cookTime],
    [dict.recipeDetail.totalTime, recipe.totalTime],
    [dict.recipeDetail.temperature, recipe.temperature],
  ].filter(([, value]) => value);

  if (meta.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-stone-200 py-5 sm:grid-cols-4 lg:gap-x-8 lg:gap-y-6 lg:py-7">
      {meta.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-soft-peach-700 lg:text-[0.65rem] lg:tracking-[0.22em]">
            {label}
          </dt>
          <dd className="mt-1.5 font-heading text-base font-black text-stone-800 lg:mt-2 lg:text-xl">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatQuantity(ingredient: Ingredient) {
  if (!ingredient.quantity) return "";
  return `${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;
}
