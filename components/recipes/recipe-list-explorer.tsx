"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { RECIPE_CATEGORIES, type RecipeCategory } from "@/lib/recipe-categories";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { RecipeSummary } from "./types";
import { RecipeGrid } from "./recipe-grid";
import { RecipeListRows } from "./recipe-list-rows";
import { RecipeCreationChooser } from "./recipe-creation-chooser";

const categoryValues = RECIPE_CATEGORIES;
const viewValues = ["cards", "list"] as const;
const sortValues = ["alpha", "date"] as const;
const sortDirectionValues = ["asc", "desc"] as const;

type RecipeView = (typeof viewValues)[number];
type RecipeSort = (typeof sortValues)[number];
type RecipeSortDirection = (typeof sortDirectionValues)[number];

type RecipeListExplorerProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: RecipeSummary[];
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
  const activeSortDirection = getActiveSortDirection(searchParams, activeSort);
  const [draftState, setDraftState] = useState({ query, value: query });
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const draftQuery = draftState.query === query ? draftState.value : query;

  const filteredRecipes = useMemo(
    () => sortRecipes(
      filterRecipes(recipes, query, activeCategories),
      activeSort,
      activeSortDirection,
      locale,
    ),
    [activeCategories, activeSort, activeSortDirection, locale, query, recipes],
  );
  const hasActiveFilters = query.length > 0 || activeCategories.length > 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateUrl({
      query: draftQuery.trim(),
      categories: activeCategories,
      view: activeView,
      sort: activeSort,
      direction: activeSortDirection,
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
      direction: activeSortDirection,
      mode: "push",
    });
  }

  function setView(view: RecipeView) {
    updateUrl({
      query,
      categories: activeCategories,
      view,
      sort: activeSort,
      direction: activeSortDirection,
      mode: "push",
    });
  }

  function setSort(sort: RecipeSort) {
    const direction = sort === activeSort
      ? activeSortDirection === "asc" ? "desc" : "asc"
      : getDefaultSortDirection(sort);
    updateUrl({
      query,
      categories: activeCategories,
      view: activeView,
      sort,
      direction,
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
          <RecipeCreationChooser locale={locale} dict={dict} trigger="icon" />
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
            <span aria-hidden className="relative size-5">
              <Search className={cn("absolute inset-0 size-5 stroke-[1.8] transition-[scale,opacity,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]", mobileSearchOpen ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0")} />
              <X className={cn("absolute inset-0 size-5 stroke-[1.8] transition-[scale,opacity,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]", mobileSearchOpen ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]")} />
            </span>
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
            <InputGroup className="h-11">
              <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
              <InputGroupInput
                id="recipe-search"
                name="q"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                value={draftQuery}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setDraftState({ query, value: event.target.value })
                }
                className="h-11"
                placeholder={dict.recipeList.searchPlaceholder}
              />
            </InputGroup>
            <Button type="submit" size="lg" className="h-11">
              <Search data-icon="inline-start" />
              {dict.recipeList.searchSubmit}
            </Button>
          </form>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ToggleGroup
              multiple
              value={activeCategories}
              onValueChange={(values: string[]) => updateUrl({ query, categories: values as RecipeCategory[], view: activeView, sort: activeSort, direction: activeSortDirection, mode: "push" })}
              spacing={2}
              className="flex w-full flex-wrap lg:w-auto lg:min-w-0 lg:flex-1"
              aria-label={dict.recipeList.categoriesLabel}
            >
              {categoryValues.map((category) => (
                  <ToggleGroupItem key={category} value={category} className="min-h-11 rounded-full px-4 font-bold md:min-h-10">
                    {dict.recipeList.categories[category]}
                  </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex shrink-0 flex-nowrap items-center gap-3 self-end whitespace-nowrap text-sm font-bold text-muted-foreground lg:self-auto">
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
            <ToggleGroup
              value={[activeView]}
              onValueChange={(values: string[]) => values[0] && setView(values[0] as RecipeView)}
              spacing={2}
              className="hidden flex-wrap md:flex"
              aria-label={dict.recipeList.viewLabel}
            >
              {viewValues.map((view) => {
                const Icon = view === "cards" ? LayoutGrid : List;
                return (
                  <ToggleGroupItem key={view} value={view} className="min-h-10 rounded-full px-4 font-bold">
                    <Icon data-icon="inline-start" />
                    {dict.recipeList.views[view]}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>

            <ToggleGroup
              value={[activeSort]}
              onValueChange={(values: string[]) => setSort((values[0] as RecipeSort | undefined) ?? activeSort)}
              spacing={2}
              className="flex flex-wrap"
              aria-label={dict.recipeList.sortLabel}
            >
              {sortValues.map((sort) => {
                const direction = sort === activeSort
                  ? activeSortDirection
                  : getDefaultSortDirection(sort);
                const Icon = sort === "alpha"
                  ? direction === "asc" ? ArrowDownAZ : ArrowUpAZ
                  : direction === "asc" ? CalendarArrowUp : CalendarArrowDown;
                return (
                  <ToggleGroupItem key={sort} value={sort} className="min-h-11 rounded-full px-4 font-bold md:min-h-10">
                    <Icon data-icon="inline-start" />
                    {dict.recipeList.sorts[sort]}
                    {sort === activeSort ? (
                      <span className="sr-only">
                        {locale === "fr"
                          ? direction === "asc" ? "ordre croissant" : "ordre décroissant"
                          : direction === "asc" ? "ascending" : "descending"}
                      </span>
                    ) : null}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
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
                showAddRecipeCard={!hasActiveFilters}
              />
            </div>
            <div className="hidden md:block">
              <RecipeListRows
                locale={locale}
                dict={dict}
                recipes={filteredRecipes}
                showAddRecipeRow={!hasActiveFilters}
              />
            </div>
          </>
        ) : (
          <RecipeGrid
            locale={locale}
            dict={dict}
            recipes={filteredRecipes}
            showAddRecipeCard={!hasActiveFilters}
          />
        )
      ) : (
        <Empty className="border border-border py-12">
          <EmptyHeader className="">
          <EmptyTitle className="type-content-title">{dict.recipeList.noResultsTitle}</EmptyTitle>
          <EmptyDescription className="type-body max-w-xl font-semibold">
            {recipes.length === 0
              ? dict.recipeList.emptyDescription
              : dict.recipeList.noResultsDescription}
          </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function filterRecipes(
  recipes: RecipeSummary[],
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
      recipe.categories.some((category) => selectedCategories.has(category));

    return matchesQuery && matchesCategory;
  });
}

function sortRecipes(
  recipes: RecipeSummary[],
  sort: RecipeSort,
  direction: RecipeSortDirection,
  locale: Locale,
) {
  return [...recipes].sort((recipeA, recipeB) => {
    const comparison = sort === "date"
      ? recipeA._creationTime - recipeB._creationTime
      : recipeA.title.localeCompare(recipeB.title, locale);

    return direction === "asc" ? comparison : -comparison;
  });
}

function getRecipeSearchText(recipe: RecipeSummary) {
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

function getActiveSortDirection(
  searchParams: { get: (name: string) => string | null },
  sort: RecipeSort,
) {
  const value = searchParams.get("order");
  return sortDirectionValues.includes(value as RecipeSortDirection)
    ? value as RecipeSortDirection
    : getDefaultSortDirection(sort);
}

function getDefaultSortDirection(sort: RecipeSort): RecipeSortDirection {
  return sort === "date" ? "desc" : "asc";
}

function updateUrl({
  query,
  categories,
  view,
  sort,
  direction,
  mode,
}: {
  query: string;
  categories: RecipeCategory[];
  view: RecipeView;
  sort: RecipeSort;
  direction: RecipeSortDirection;
  mode: "push" | "replace";
}) {
  const params = new URLSearchParams(window.location.search);
  params.delete("q");
  params.delete("cat");
  params.delete("view");
  params.delete("sort");
  params.delete("order");

  if (query) {
    params.set("q", query);
  }

  for (const category of categories) {
    params.append("cat", category);
  }

  params.set("view", view);
  params.set("sort", sort);
  params.set("order", direction);

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
