"use client";

import { type FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownAZ, CalendarDays, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Recipe } from "./types";
import { RecipeGrid } from "./recipe-grid";
import { RecipeListRows } from "./recipe-list-rows";

const categoryValues = ["dessert", "plat", "sucre", "sale"] as const;
const viewValues = ["cards", "list"] as const;
const sortValues = ["alpha", "date"] as const;

type RecipeCategory = (typeof categoryValues)[number];
type RecipeView = (typeof viewValues)[number];
type RecipeSort = (typeof sortValues)[number];

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
  const activeView = getActiveView(searchParams);
  const activeSort = getActiveSort(searchParams);
  const [draftState, setDraftState] = useState({ query, value: query });
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const draftQuery = draftState.query === query ? draftState.value : query;

  const filteredRecipes = useMemo(
    () => sortRecipes(filterRecipes(recipes, query, activeCategories), activeSort, locale),
    [activeCategories, activeSort, locale, query, recipes],
  );
  const hasActiveFilters = query.length > 0 || activeCategories.length > 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateUrl({
      query: draftQuery.trim(),
      categories: activeCategories,
      view: activeView,
      sort: activeSort,
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
      view: activeView,
      sort: activeSort,
      mode: "push",
    });
  }

  function resetFilters() {
    setDraftState({ query: "", value: "" });
    updateUrl({
      query: "",
      categories: [],
      view: activeView,
      sort: activeSort,
      mode: "push",
    });
  }

  function setView(view: RecipeView) {
    updateUrl({
      query,
      categories: activeCategories,
      view,
      sort: activeSort,
      mode: "push",
    });
  }

  function setSort(sort: RecipeSort) {
    updateUrl({
      query,
      categories: activeCategories,
      view: activeView,
      sort,
      mode: "push",
    });
  }

  return (
    <div className="grid gap-3 md:gap-10">
      <section
        aria-label={dict.recipeList.filtersLabel}
        className="grid gap-3 md:gap-0"
      >
        <div className="flex justify-self-end gap-2 md:hidden">
          <Link
            href={`/${locale}/admin/recettes?new=1`}
            aria-label={dict.recipeList.addRecipeTitle}
            className="surface-elevated inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[scale,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96]"
          >
            <Plus aria-hidden className="size-5 stroke-[1.8]" />
          </Link>
          <button
            type="button"
            aria-expanded={mobileSearchOpen}
            aria-controls="recipe-search-controls"
            aria-label={
              mobileSearchOpen
                ? dict.recipeList.closeSearch
                : dict.recipeList.searchLabel
            }
            onClick={() => setMobileSearchOpen((open) => !open)}
            className="surface-elevated inline-flex size-11 items-center justify-center rounded-full bg-card text-foreground transition-[scale,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96]"
          >
            {mobileSearchOpen ? (
              <X aria-hidden className="size-5 stroke-[1.8]" />
            ) : (
              <Search aria-hidden className="size-5 stroke-[1.8]" />
            )}
          </button>
        </div>

        <div
          id="recipe-search-controls"
          className={cn(
            "surface-elevated gap-5 rounded-3xl bg-card p-4 md:grid md:p-6",
            mobileSearchOpen ? "grid" : "hidden",
          )}
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
                className="h-11 pl-9"
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
                      "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold shadow-[0_0_0_1px_var(--border)] transition-[scale,background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96] md:min-h-10",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--primary)]"
                        : "bg-background text-foreground hover:text-primary hover:shadow-[0_0_0_1px_var(--primary)]",
                    )}
                  >
                    {dict.recipeList.categories[category]}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-muted-foreground">
              <span aria-live="polite" className="tabular-nums">
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

          <div className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
            <div
              className="hidden flex-wrap gap-2 md:flex"
              aria-label={dict.recipeList.viewLabel}
            >
              {viewValues.map((view) => {
                const isActive = activeView === view;
                const Icon = view === "cards" ? LayoutGrid : List;
                return (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setView(view)}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold shadow-[0_0_0_1px_var(--border)] transition-[scale,background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96]",
                      isActive
                        ? "bg-foreground text-background shadow-[0_0_0_1px_var(--foreground)]"
                        : "bg-background text-foreground hover:shadow-[0_0_0_1px_var(--foreground)]",
                    )}
                  >
                    <Icon className="size-4 stroke-[1.8]" />
                    {dict.recipeList.views[view]}
                  </button>
                );
              })}
            </div>

            <div
              className="flex flex-wrap gap-2"
              aria-label={dict.recipeList.sortLabel}
            >
              {sortValues.map((sort) => {
                const isActive = activeSort === sort;
                const Icon = sort === "alpha" ? ArrowDownAZ : CalendarDays;
                return (
                  <button
                    key={sort}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSort(sort)}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold shadow-[0_0_0_1px_var(--border)] transition-[scale,background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96] md:min-h-10",
                      isActive
                        ? "bg-foreground text-background shadow-[0_0_0_1px_var(--foreground)]"
                        : "bg-background text-foreground hover:shadow-[0_0_0_1px_var(--foreground)]",
                    )}
                  >
                    <Icon className="size-4 stroke-[1.8]" />
                    {dict.recipeList.sorts[sort]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {filteredRecipes.length > 0 ? (
        activeView === "list" ? (
          <>
            <div className="md:hidden">
              <RecipeGrid
                locale={locale}
                dict={dict}
                recipes={filteredRecipes}
                priorityFirstImage={false}
              />
            </div>
            <div className="hidden md:block">
              <RecipeListRows
                locale={locale}
                dict={dict}
                recipes={filteredRecipes}
              />
            </div>
          </>
        ) : (
          <RecipeGrid
            locale={locale}
            dict={dict}
            recipes={filteredRecipes}
          />
        )
      ) : (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <h2 className="type-content-title text-foreground">
            {dict.recipeList.noResultsTitle}
          </h2>
          <p className="type-body mx-auto mt-3 max-w-xl font-semibold text-muted-foreground [text-wrap:pretty]">
            {recipes.length === 0
              ? dict.recipeList.emptyDescription
              : dict.recipeList.noResultsDescription}
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
  const selectedCategories = new Set<string>(categories);

  return recipes.filter((recipe) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      getRecipeSearchText(recipe).includes(normalizedQuery);
    const matchesCategory =
      categories.length === 0 ||
      recipe.tags.some((category) => selectedCategories.has(category));

    return matchesQuery && matchesCategory;
  });
}

function sortRecipes(recipes: Recipe[], sort: RecipeSort, locale: Locale) {
  return [...recipes].sort((recipeA, recipeB) => {
    if (sort === "date") {
      return recipeB._creationTime - recipeA._creationTime;
    }

    return recipeA.title.localeCompare(recipeB.title, locale);
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

function getActiveView(searchParams: { get: (name: string) => string | null }) {
  const value = searchParams.get("view");
  return viewValues.includes(value as RecipeView) ? (value as RecipeView) : "cards";
}

function getActiveSort(searchParams: { get: (name: string) => string | null }) {
  const value = searchParams.get("sort");
  return sortValues.includes(value as RecipeSort) ? (value as RecipeSort) : "alpha";
}

function updateUrl({
  query,
  categories,
  view,
  sort,
  mode,
}: {
  query: string;
  categories: RecipeCategory[];
  view: RecipeView;
  sort: RecipeSort;
  mode: "push" | "replace";
}) {
  const params = new URLSearchParams(window.location.search);
  params.delete("q");
  params.delete("cat");
  params.delete("view");
  params.delete("sort");

  if (query) {
    params.set("q", query);
  }

  for (const category of categories) {
    params.append("cat", category);
  }

  params.set("view", view);
  params.set("sort", sort);

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
