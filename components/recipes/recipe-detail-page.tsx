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
import { EditRecipeAccess } from "./edit-recipe-access";
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
    <main className="text-foreground">
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

        <EditRecipeAccess
          locale={locale}
          slug={recipe.slug}
        />

        {recipe.imageCredit ? (
          <HeroImageCredit imageCredit={recipe.imageCredit} />
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto w-full max-w-6xl px-4 pb-6 text-white sm:pb-10 lg:px-10 lg:pb-20">
            <div className="type-label mb-3 inline-flex items-center gap-2 text-white/85 tabular-nums lg:mb-5">
              <Clock3 className="size-4 stroke-[1.8]" />
              <span>{recipe.timeLabel}</span>
            </div>
            <h1 className="type-display max-w-[14ch] drop-shadow-sm">
              {recipe.title}
            </h1>
            <p className="type-byline mt-3 text-white/80 lg:mt-5">
              {dict.recipeDetail.recipeBy} {recipe.author}
            </p>
          </div>
        </div>
      </header>

      {/* Lead description */}
      {recipe.description ? (
        <section className="bg-muted px-4 py-10 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="type-editorial-lead mx-auto text-foreground/80">
              {recipe.description}
            </p>
            <div
              aria-hidden
              className="mx-auto mt-6 h-px w-16 bg-border lg:mt-10"
            />
          </div>
        </section>
      ) : null}

      {/* Body: instructions + sticky ingredients sidebar */}
      <section className="px-4 pb-16 lg:px-10 lg:pb-32">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,65ch)_22rem] lg:justify-center lg:gap-16">
          <div className="min-w-0">
            <RecipeMeta dict={dict} recipe={recipe} />

            <div className="mt-8 space-y-8 lg:mt-14 lg:space-y-12">
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
                            {subRecipe.ingredients.map((ingredient, index) => (
                              <li
                                key={`${subRecipe.title}-${ingredient.name}-${ingredient.unit}-${index}`}
                                className="type-body-sm flex items-baseline justify-between gap-4 py-2.5"
                              >
                                <span className="font-semibold text-foreground">
                                  {ingredient.name}
                                </span>
                                <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
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
                            <span className="font-semibold text-foreground">
                              {ingredient.name}
                            </span>
                            <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
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
                    <AccordionItem value="notes" className="border-t border-border">
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

          {/* Sidebar — ingredients */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            {/* Mobile: collapsible card */}
            <div className="lg:hidden">
              <div className="rounded-2xl bg-muted px-4 ring-1 ring-border">
                <Accordion defaultValue="ingredients">
                  <AccordionItem value="ingredients">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                        <span className="type-content-title text-foreground">
                          {dict.recipeDetail.ingredients}
                        </span>
                        {recipe.servings ? (
                          <span className="type-label shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground tabular-nums">
                            {recipe.servings.quantity} {recipe.servings.unit}
                          </span>
                        ) : null}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="divide-y divide-border border-t border-border">
                        {recipe.ingredients.map((ingredient, index) => (
                          <li
                            key={`${ingredient.name}-${ingredient.unit}-${index}`}
                            className="type-body-sm flex items-baseline justify-between gap-3 py-2"
                          >
                            <span className="font-semibold text-foreground">
                              {ingredient.name}
                              {ingredient.notes ? (
                                <span className="mt-0.5 block text-xs font-medium italic text-muted-foreground">
                                  {ingredient.notes}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
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
            <div className="hidden rounded-2xl bg-muted p-7 ring-1 ring-border lg:block lg:p-8">
              <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border pb-4">
                <h2 className="type-content-title text-foreground">
                  {dict.recipeDetail.ingredients}
                </h2>
                {recipe.servings ? (
                  <span className="type-label shrink-0 rounded-full bg-secondary px-3 py-1 text-secondary-foreground tabular-nums">
                    {recipe.servings.quantity} {recipe.servings.unit}
                  </span>
                ) : null}
              </div>
              <ul className="divide-y divide-border">
                {recipe.ingredients.map((ingredient, index) => (
                  <li
                    key={`${ingredient.name}-${ingredient.unit}-${index}`}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <span className="font-semibold text-foreground">
                      {ingredient.name}
                      {ingredient.notes ? (
                        <span className="mt-0.5 block text-sm font-medium italic text-muted-foreground">
                          {ingredient.notes}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
                      {formatQuantity(ingredient)}
                    </span>
                  </li>
                ))}
              </ul>
              {recipe.totalTime ? (
                <p className="type-label mt-6 border-t border-border pt-4 text-muted-foreground tabular-nums">
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
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-border py-5 sm:grid-cols-4 lg:gap-x-8 lg:gap-y-6 lg:py-7">
      {meta.map(([label, value]) => (
        <div key={label}>
          <dt className="type-label text-primary">
            {label}
          </dt>
          <dd className="type-subsection-title mt-1.5 text-foreground tabular-nums lg:mt-2">
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

function HeroImageCredit({
  imageCredit,
}: {
  imageCredit: NonNullable<Recipe["imageCredit"]>;
}) {
  if (imageCredit.provider === "unsplash") {
    return (
      <p className="type-meta absolute right-4 top-5 z-10 text-right text-white/80 lg:right-10 lg:top-8">
        Photo{" "}
        <a
          href={imageCredit.photographerUrl}
          target="_blank"
          rel="noreferrer"
          className="content-link hover:text-white"
        >
          {imageCredit.photographerName}
        </a>{" "}
        /{" "}
        <a
          href={imageCredit.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="content-link hover:text-white"
        >
          Unsplash
        </a>
      </p>
    );
  }

  return (
    <p className="type-meta absolute right-4 top-5 z-10 max-w-[18rem] text-right text-white/80 lg:right-10 lg:top-8">
      Photo{" "}
      <a
        href={imageCredit.creatorUrl}
        target="_blank"
        rel="noreferrer"
        className="content-link hover:text-white"
      >
        {imageCredit.creator}
      </a>{" "}
      /{" "}
      <a
        href={imageCredit.landingUrl}
        target="_blank"
        rel="noreferrer"
        className="content-link hover:text-white"
      >
        {imageCredit.source}
      </a>{" "}
      /{" "}
      <a
        href={imageCredit.licenseUrl}
        target="_blank"
        rel="noreferrer"
        className="content-link hover:text-white"
      >
        {formatOpenverseLicense(imageCredit)}
      </a>
    </p>
  );
}

function formatOpenverseLicense({
  license,
  licenseVersion,
}: {
  license: string;
  licenseVersion: string;
}) {
  return [license ? `CC ${license.toUpperCase()}` : "", licenseVersion]
    .filter(Boolean)
    .join(" ");
}
