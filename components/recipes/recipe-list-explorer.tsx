"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Recipe } from "./types";
import { RecipeGrid } from "./recipe-grid";

const categoryValues = ["dessert", "plat", "sucre", "sale"] as const;

type RecipeCategory = (typeof categoryValues)[number];

type RecipeListExplorerProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: Recipe[];
};

export function RecipeListExplorer({
  locale,
  dict,
  recipes,
}: RecipeListExplorerProps) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const activeCategories = getActiveCategories(searchParams);
  const [draftState, setDraftState] = useState({ query, value: query });
  const draftQuery = draftState.query === query ? draftState.value : query;

  const filteredRecipes = useMemo(
    () => filterRecipes(recipes, query, activeCategories),
    [activeCategories, query, recipes],
  );
  const hasActiveFilters = query.length > 0 || activeCategories.length > 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateUrl({
      query: draftQuery.trim(),
      categories: activeCategories,
      mode: "push",
    });
  }

  function toggleCategory(category: RecipeCategory) {
    const nextCategories = activeCategories.includes(category)
      ? activeCategories.filter((value) => value !== category)
      : [...activeCategories, category];

    updateUrl({
      query,
      categories: nextCategories,
      mode: "push",
    });
  }

  function resetFilters() {
    setDraftState({ query: "", value: "" });
    updateUrl({ query: "", categories: [], mode: "push" });
  }

  return (
    <div className="grid gap-8">
      <section
        aria-label={dict.recipeList.filtersLabel}
        className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-5"
      >
        <form
          onSubmit={submitSearch}
          className="grid gap-3 md:grid-cols-[1fr_auto]"
        >
          <label className="sr-only" htmlFor="recipe-search">
            {dict.recipeList.searchLabel}
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="recipe-search"
              name="q"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              value={draftQuery}
              onChange={(event) =>
                setDraftState({ query, value: event.target.value })
              }
              className="h-11 pl-9 text-base"
              placeholder={dict.recipeList.searchPlaceholder}
            />
          </div>
          <Button type="submit" size="lg" className="h-11">
            <Search data-icon="inline-start" />
            {dict.recipeList.searchSubmit}
          </Button>
        </form>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex flex-wrap gap-2"
            aria-label={dict.recipeList.categoriesLabel}
          >
            {categoryValues.map((category) => {
              const isActive = activeCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleCategory(category)}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/60 hover:text-primary",
                  )}
                >
                  {dict.recipeList.categories[category]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-muted-foreground">
            <span aria-live="polite">
              {formatResultCount(dict, filteredRecipes.length, recipes.length)}
            </span>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
              >
                <X data-icon="inline-start" />
                {dict.recipeList.reset}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {filteredRecipes.length > 0 ? (
        <RecipeGrid
          locale={locale}
          dict={dict}
          recipes={filteredRecipes}
          featureFirst={!hasActiveFilters}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="font-heading text-3xl font-black text-foreground">
            {dict.recipeList.noResultsTitle}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-base font-semibold leading-7 text-muted-foreground">
            {dict.recipeList.noResultsDescription}
          </p>
        </div>
      )}
    </div>
  );
}

function filterRecipes(
  recipes: Recipe[],
  query: string,
  categories: RecipeCategory[],
) {
  const normalizedQuery = normalizeSearchText(query);

  return recipes.filter((recipe) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      getRecipeSearchText(recipe).includes(normalizedQuery);
    const matchesCategory =
      categories.length === 0 ||
      categories.some((category) => recipe.tags.includes(category));

    return matchesQuery && matchesCategory;
  });
}

function getRecipeSearchText(recipe: Recipe) {
  return normalizeSearchText(
    [recipe.title, ...recipe.ingredients.map((ingredient) => ingredient.name)].join(
      " ",
    ),
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getActiveCategories(searchParams: { getAll: (name: string) => string[] }) {
  return searchParams
    .getAll("cat")
    .filter((value): value is RecipeCategory =>
      categoryValues.includes(value as RecipeCategory),
    );
}

function updateUrl({
  query,
  categories,
  mode,
}: {
  query: string;
  categories: RecipeCategory[];
  mode: "push" | "replace";
}) {
  const params = new URLSearchParams(window.location.search);
  params.delete("q");
  params.delete("cat");

  if (query) {
    params.set("q", query);
  }

  for (const category of categories) {
    params.append("cat", category);
  }

  const nextUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;

  if (mode === "replace") {
    window.history.replaceState(null, "", nextUrl);
  } else {
    window.history.pushState(null, "", nextUrl);
  }
}

function formatResultCount(dict: Dictionary, count: number, total: number) {
  const label =
    count > 1 ? dict.recipeList.resultsPlural : dict.recipeList.resultsSingular;
  return dict.recipeList.resultCount
    .replace("{count}", String(count))
    .replace("{total}", String(total))
    .replace("{label}", label);
}
