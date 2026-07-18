import Image from "next/image";
import Link from "next/link";
import { Clock3, Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "./types";

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

type RecipeListRowsProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: Recipe[];
  showAddRecipeRow?: boolean;
};

export function RecipeListRows({
  locale,
  dict,
  recipes,
  showAddRecipeRow = false,
}: RecipeListRowsProps) {
  if (recipes.length === 0) return null;

  return (
    <ul className="grid gap-4">
      {recipes.map((recipe) => (
        <li key={recipe._id}>
          <Link
            href={`/${locale}/recettes/${recipe.slug}`}
            className="group grid gap-4 rounded-2xl border border-border bg-card p-3 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:grid-cols-[11rem_1fr] sm:items-center"
          >
            <span className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted sm:aspect-[5/4]">
              <Image
                src={recipe.heroImageUrl || defaultRecipeImageUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 180px"
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
              />
            </span>
            <span className="grid gap-3 px-1 py-1 sm:py-3">
              <span className="type-label inline-flex items-center gap-2 text-primary tabular-nums">
                <Clock3 className="size-4 stroke-[1.8]" />
                {recipe.timeLabel}
              </span>
              <span className="grid gap-2">
                <span className="type-card-title text-foreground">
                  {recipe.title}
                </span>
                <span className="type-byline text-muted-foreground">
                  {dict.recipeDetail.recipeBy} {recipe.author}
                </span>
              </span>
              {recipe.description ? (
                <span className="type-body-sm line-clamp-2 font-semibold text-foreground/75">
                  {recipe.description}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
      {showAddRecipeRow ? (
        <li>
          <Link
            href={`/${locale}/admin/recettes?new=1`}
            className="group grid gap-4 rounded-2xl border border-dashed border-primary/40 bg-card p-4 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-primary hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:grid-cols-[11rem_1fr] sm:items-center"
          >
            <span
              aria-hidden
              className="flex aspect-[4/3] items-center justify-center rounded-xl bg-primary/10 text-primary transition duration-300 group-hover:bg-primary group-hover:text-primary-foreground sm:aspect-[5/4]"
            >
              <Plus className="size-12 stroke-[1.8]" />
            </span>
            <span className="grid gap-2 px-1 py-1 sm:py-3">
              <span className="type-card-title text-foreground">
                {dict.recipeList.addRecipeTitle}
              </span>
              <span className="type-body-sm font-bold text-muted-foreground">
                {dict.recipeList.addRecipeDescription}
              </span>
            </span>
          </Link>
        </li>
      ) : null}
    </ul>
  );
}
