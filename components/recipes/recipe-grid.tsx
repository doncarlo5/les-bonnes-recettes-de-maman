import Image from "next/image";
import Link from "next/link";
import { Clock3, Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "./types";

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

type RecipeGridProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: Recipe[];
  showAddRecipeCard?: boolean;
};

export function RecipeGrid({
  locale,
  dict,
  recipes,
  showAddRecipeCard = false,
}: RecipeGridProps) {
  if (recipes.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {recipes.map((recipe, index) => {
        return (
          <li key={recipe._id}>
            <Link
              href={`/${locale}/recettes/${recipe.slug}`}
              className="surface-elevated group block overflow-hidden rounded-3xl bg-card text-start transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="relative block aspect-[4/3] overflow-hidden rounded-t-3xl bg-muted">
                <Image
                  src={recipe.heroImageUrl || defaultRecipeImageUrl}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 540px"
                  className="image-outline object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                />
              </span>
              <span className="block p-6 sm:p-7">
                <span className="type-label mb-4 inline-flex items-center gap-2 text-primary tabular-nums">
                  <Clock3 className="size-4 stroke-[1.8]" />
                  {recipe.timeLabel}
                </span>
                <span
                  className="type-card-title block max-w-[18ch] text-foreground"
                >
                  {recipe.title}
                </span>
                <span className="type-byline mt-3 block text-muted-foreground">
                  {dict.recipeDetail.recipeBy} {recipe.author}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
      {showAddRecipeCard ? (
        <li>
          <Link
            href={`/${locale}/admin/recettes?new=1`}
            className="surface-elevated group flex min-h-80 w-full flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl text-center transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span
              aria-hidden
              className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary transition-[scale,background-color,color] duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground"
            >
              <Plus className="size-10 stroke-[1.8]" />
            </span>
            <span className="grid gap-2 px-8">
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
