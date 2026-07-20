"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Clock3 } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  formatScaledIngredient,
  getServingsFactor,
  resolveSelectedServings,
} from "@/lib/recipe-servings";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EditRecipeAccess } from "./edit-recipe-access";
import { CookModeEntry } from "./cook-mode-entry";
import { RecipeIngredientsPanel } from "./recipe-ingredients-panel";
import { RecipeComments } from "./recipe-comments";
import type { Recipe } from "./types";

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

type RecipeDetailPageProps = {
  locale: Locale;
  dict: Dictionary;
  recipe: Recipe;
  mode?: "public" | "preview";
  initialServings?: number;
};

export function RecipeDetailPage({
  locale,
  dict,
  recipe,
  mode = "public",
  initialServings,
}: RecipeDetailPageProps) {
  return (
    <RecipePresentation
      key={`${recipe.slug}:${recipe.referenceServings ?? "none"}:${initialServings ?? "default"}`}
      locale={locale}
      dict={dict}
      recipe={recipe}
      mode={mode}
      initialServings={initialServings}
    />
  );
}

export function RecipePresentation({
  locale,
  dict,
  recipe,
  mode,
  initialServings,
}: RecipeDetailPageProps & { mode: "public" | "preview" }) {
  const [selectedServings, setSelectedServings] = useState(() =>
    resolveSelectedServings(recipe.referenceServings, initialServings),
  );
  const servingsFactor = getServingsFactor(
    recipe.referenceServings,
    selectedServings,
  );
  return (
    <main className="text-foreground">
      <header className="px-5 py-8 sm:py-12 lg:px-10 lg:py-20">
        {mode === "public" ? (
          <Link
            href={`/${locale}#recettes`}
            className="mx-auto mb-4 flex min-h-11 max-w-7xl items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-[scale,background-color,color] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] lg:hidden"
          >
            <ChevronLeft className="size-5" />
            {dict.recipeDetail.backToList}
          </Link>
        ) : null}
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:items-center lg:gap-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted shadow-card lg:aspect-[5/4]">
            <Image
              src={recipe.heroImageUrl || defaultRecipeImageUrl}
              alt={recipe.imageCredit?.alt ?? ""}
              fill
              priority={mode === "public"}
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="image-outline object-cover"
            />
          </div>

          <div className="flex flex-col items-start">
            {mode === "public" ? (
              <Link
                href={`/${locale}#recettes`}
                className="mb-8 hidden min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-[scale,background-color,color] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] lg:inline-flex lg:min-h-10"
              >
                <ChevronLeft className="size-5" />
                {dict.recipeDetail.backToList}
              </Link>
            ) : null}
            <div className="type-label mb-5 inline-flex items-center gap-2 text-primary tabular-nums">
              <Clock3 className="size-4 stroke-[1.8]" />
              <span>{recipe.timeLabel}</span>
            </div>
            <h1 className="type-display max-w-[14ch]">{recipe.title}</h1>
            <p className="type-byline mt-4 text-muted-foreground">
              {dict.recipeDetail.recipeBy} {recipe.author}
            </p>
            {recipe.description ? (
              <p className="type-editorial-lead mt-7 max-w-[52ch] text-foreground/75">
                {recipe.description}
              </p>
            ) : null}
            {mode === "public" ? (
              <div className="mt-8 grid gap-4">
                <CookModeEntry
                  locale={locale}
                  dict={dict}
                  recipe={recipe}
                  selectedServings={selectedServings}
                />
                <EditRecipeAccess locale={locale} slug={recipe.slug} />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Body: instructions + sticky ingredients sidebar */}
      <section className="border-t border-border px-5 pb-16 lg:px-10 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <RecipeMeta dict={dict} recipe={recipe} />

          <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(0,65ch)_20rem] lg:justify-between lg:gap-14">
            <div className="min-w-0">
              <div className="space-y-8 lg:space-y-12">
                {recipe.equipment.length > 0 ? (
                  <div>
                    <h2 className="type-content-title mb-4 text-foreground lg:mb-6">
                      {dict.recipeDetail.equipment}
                    </h2>
                    <ul className="type-body-spacious list-disc space-y-2 pl-5 text-foreground/90">
                      {recipe.equipment.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {recipe.sections.map((section) => (
                  <div key={section.title}>
                    <h2 className="type-content-title mb-4 text-foreground lg:mb-6">
                      {section.title}
                    </h2>
                    <ol className="space-y-4 lg:space-y-6">
                      {section.steps.map((step, index) => (
                        <li
                          key={step}
                          className="type-body-spacious grid grid-cols-[2rem_1fr] gap-3 text-foreground/90 lg:grid-cols-[2.5rem_1fr] lg:gap-5"
                        >
                          <span className="type-meta mt-0.5 flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary lg:mt-1 lg:size-9">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
                {recipe.relatedRecipes.length > 0 ? (
                  <div>
                    <h2 className="type-content-title mb-4 text-foreground lg:mb-6">
                      {dict.recipeDetail.relatedRecipes}
                    </h2>
                    <ul className="space-y-3">
                      {recipe.relatedRecipes.map((related) => (
                        <li key={related.slug}>
                          <Link
                            href={`/${locale}/recettes/${related.slug}`}
                            className="type-body-spacious font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
                          >
                            {related.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {recipe.subRecipes.length > 0 ? (
                <>
                  {/* Mobile: accordion */}
                  <div className="mt-8 lg:hidden">
                    <h2 className="type-content-title mb-3 text-foreground">
                      {dict.recipeDetail.subRecipes}
                    </h2>
                    <Accordion
                      className="border-t border-border"
                      defaultValue={recipe.subRecipes[0]?.title}
                    >
                      {recipe.subRecipes.map((subRecipe) => (
                        <AccordionItem
                          key={subRecipe.title}
                          value={subRecipe.title}
                        >
                          <AccordionTrigger className="type-subsection-title text-foreground">
                            {subRecipe.title}
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="divide-y divide-border">
                              {subRecipe.ingredients.map(
                                (ingredient, index) => (
                                  <li
                                    key={`${subRecipe.title}-${ingredient.name}-${ingredient.unit}-${index}`}
                                    className="type-body-sm flex items-baseline justify-between gap-4 py-2.5"
                                  >
                                    <span
                                      data-ingredient-name
                                      className="font-semibold text-foreground first-letter:uppercase"
                                    >
                                      {ingredient.name}
                                    </span>
                                    <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
                                      {formatScaledIngredient(
                                        ingredient,
                                        servingsFactor,
                                        locale,
                                      )}
                                    </span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>

                  {/* Desktop: stacked */}
                  <div className="mt-14 hidden space-y-8 lg:block">
                    <h2 className="type-content-title text-foreground">
                      {dict.recipeDetail.subRecipes}
                    </h2>
                    {recipe.subRecipes.map((subRecipe) => (
                      <div key={subRecipe.title}>
                        <h3 className="type-subsection-title mb-3 text-foreground">
                          {subRecipe.title}
                        </h3>
                        <ul className="divide-y divide-border">
                          {subRecipe.ingredients.map((ingredient, index) => (
                            <li
                              key={`${subRecipe.title}-${ingredient.name}-${ingredient.unit}-${index}`}
                              className="type-body flex items-baseline justify-between gap-5 py-3"
                            >
                              <span
                                data-ingredient-name
                                className="font-semibold text-foreground first-letter:uppercase"
                              >
                                {ingredient.name}
                              </span>
                              <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
                                {formatScaledIngredient(
                                  ingredient,
                                  servingsFactor,
                                  locale,
                                )}
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
                      <AccordionItem
                        value="notes"
                        className="border-t border-border"
                      >
                        <AccordionTrigger className="type-content-title text-foreground">
                          {dict.recipeDetail.notes}
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="type-body space-y-2 text-muted-foreground">
                            {recipe.notes.map((note) => (
                              <li
                                key={note}
                                className="border-l-2 border-primary/40 pl-4 italic"
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
                    <h2 className="type-content-title mb-5 text-foreground">
                      {dict.recipeDetail.notes}
                    </h2>
                    <ul className="type-body-spacious space-y-3 text-muted-foreground">
                      {recipe.notes.map((note) => (
                        <li
                          key={note}
                          className="border-l-2 border-primary/40 pl-5 italic"
                        >
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>

            <RecipeIngredientsPanel
              locale={locale}
              dict={dict}
              recipe={recipe}
              selectedServings={selectedServings}
              onSelectedServingsChange={setSelectedServings}
            />
          </div>
        </div>
      </section>
      {mode === "public" ? (
        <RecipeComments locale={locale} dict={dict} slug={recipe.slug} />
      ) : null}
    </main>
  );
}

function RecipeMeta({ dict, recipe }: { dict: Dictionary; recipe: Recipe }) {
  const meta = [
    [dict.recipeDetail.prepTime, recipe.prepTime],
    [dict.recipeDetail.cookTime, recipe.cookTime],
    [dict.recipeDetail.restTime, recipe.restTime],
    [dict.recipeDetail.totalTime, recipe.totalTime],
    [dict.recipeDetail.temperature, recipe.temperature],
  ].filter(([, value]) => value);

  if (meta.length === 0) return null;

  return (
    <dl className="flex flex-wrap items-start gap-x-8 gap-y-4 border-y border-border py-4 lg:gap-x-12 lg:py-5">
      {meta.map(([label, value]) => (
        <div key={label} className="grid min-w-fit gap-1">
          <dt className="type-label text-primary">{label}</dt>
          <dd className="whitespace-nowrap text-base font-bold leading-tight text-foreground tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
