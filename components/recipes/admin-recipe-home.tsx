"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronRight, CirclePlus, House, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Locale } from "@/i18n/config";
import type { EditableRecipeSummary } from "./types";

export function AdminRecipeHome({
  locale,
  recipes,
  onCreate,
  onSelect,
}: {
  locale: Locale;
  recipes: EditableRecipeSummary[];
  onCreate: () => void;
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visibleRecipes = recipes.filter((recipe) => {
    const matchesFilter = filter === "all" || recipe.status === filter;
    const haystack =
      `${recipe.title} ${recipe.slug} ${recipe.categories.join(" ")}`.toLocaleLowerCase(
        locale,
      );
    return (
      matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery))
    );
  });

  return (
    <main className="min-h-screen px-4 pb-28 pt-6 text-foreground">
      <header className="mx-auto grid w-full max-w-5xl gap-5">
        <div className="grid gap-4 sm:flex sm:items-end sm:justify-between">
          <div className="grid gap-2">
            <p className="type-label text-primary">Admin recettes</p>
            <h1 className="type-page-title">Le carnet</h1>
            <p className="type-body-sm font-semibold text-muted-foreground tabular-nums">
              {recipes.length} recettes à portée de main.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              href={`/${locale}`}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-sm font-semibold whitespace-nowrap transition-[scale,background-color,color,border-color,box-shadow] duration-150 outline-none select-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/80 active:scale-[0.96] md:min-h-10"
            >
              <House data-icon="inline-start" /> Site public
            </Link>
            <Button
              type="button"
              onClick={onCreate}
              className="min-h-11 rounded-xl px-4"
            >
              <CirclePlus data-icon="inline-start" /> Nouvelle
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-2 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une recette"
              className="h-11 rounded-xl border-0 bg-muted/60 pl-10 shadow-none"
            />
          </div>
          <ToggleGroup
            value={[filter]}
            onValueChange={(values: string[]) =>
              setFilter((values[0] as typeof filter | undefined) ?? filter)
            }
            variant="default"
            size="default"
            spacing={1}
            className="mt-2 grid w-full grid-cols-3"
            aria-label="Filtrer les recettes"
          >
            {(["all", "draft", "published"] as const).map((value) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="min-h-11 rounded-xl"
                aria-label={
                  value === "all"
                    ? "Toutes"
                    : value === "draft"
                      ? "Brouillons"
                      : "Publiées"
                }
              >
                {value === "all"
                  ? "Toutes"
                  : value === "draft"
                    ? "Brouillons"
                    : "Publiées"}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </header>

      <ItemGroup
        role="group"
        className="mx-auto mt-5 grid w-full max-w-5xl gap-3 lg:grid-cols-2"
        aria-label="Recettes"
      >
        {visibleRecipes.map((recipe) => (
          <Item
            key={recipe._id}
            render={
              <button type="button" onClick={() => onSelect(recipe.slug)} />
            }
            className="group min-h-24 flex-nowrap rounded-[1.25rem] border-0 bg-card p-2 text-left shadow-[var(--shadow-card)] transition-[box-shadow,scale] duration-150 active:scale-[0.96]"
          >
            <ItemMedia
              variant="image"
              className="relative size-20 rounded-xl bg-muted"
            >
              {recipe.heroImageUrl ? (
                <Image
                  src={recipe.heroImageUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                />
              ) : (
                <div className="grid size-full place-items-center">
                  <Camera className="size-5 text-muted-foreground" />
                </div>
              )}
            </ItemMedia>
            <ItemContent>
              <ItemTitle
                className="type-panel-title line-clamp-2"
                title={recipe.title || "Recette sans titre"}
              >
                {recipe.title || "Recette sans titre"}
              </ItemTitle>
              <ItemDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {recipe.isPublic
                  ? "Visible"
                  : recipe.hasPublishedVersion
                    ? "Masquée"
                    : "Jamais publiée"}
                {recipe.hasUnpublishedChanges ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-primary">
                      Modifications non publiées
                    </span>
                  </>
                ) : null}
                <span aria-hidden>·</span>
                {recipe.readiness.blockers.length === 0
                  ? "Prête"
                  : `${recipe.readiness.blockers.length} à compléter`}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRight className="mr-1 size-5 text-muted-foreground transition-transform group-active:translate-x-0.5" />
            </ItemActions>
          </Item>
        ))}
        {visibleRecipes.length === 0 ? (
          <Empty className="bg-card shadow-[var(--shadow-card)]">
            <EmptyHeader>
              <EmptyTitle>Aucune recette</EmptyTitle>
              <EmptyDescription>
                Aucune recette ne correspond aux filtres actuels.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </ItemGroup>
    </main>
  );
}
