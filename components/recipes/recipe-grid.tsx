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
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
      {recipes.map((recipe) => {
        return (
          <li key={recipe._id}>
            <Link
              href={`/${locale}/recettes/${recipe.slug}`}
              className="group relative block h-72 w-full overflow-hidden rounded-2xl bg-stone-900 text-left ring-1 ring-black/5 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:h-80"
            >
              <span className="absolute inset-0 overflow-hidden">
                <Image
                  src={recipe.heroImageUrl || defaultRecipeImageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 540px"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              </span>
              <span className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/15 to-black/65" />
              <span className="absolute inset-x-0 bottom-0 block px-7 pb-7 text-white sm:px-9 sm:pb-9">
                <span className="type-label mb-3 inline-flex items-center gap-2 text-soft-peach-200/90 tabular-nums">
                  <Clock3 className="size-4 stroke-[1.8]" />
                  {recipe.timeLabel}
                </span>
                <span
                  className="type-card-title block max-w-[18ch] text-white drop-shadow-sm"
                >
                  {recipe.title}
                </span>
                <span className="type-byline mt-3 block text-white/80">
                  {dict.recipeDetail.recipeBy} {recipe.author}
                </span>
              </span>
              <span
                aria-hidden
                className="absolute inset-x-9 bottom-0 h-px origin-center scale-x-0 bg-soft-peach-300 transition duration-500 group-hover:scale-x-100"
              />
            </Link>
          </li>
        );
      })}
      {showAddRecipeCard ? (
        <li>
          <Link
            href={`/${locale}/admin/recettes?new=1`}
            className="group flex h-72 w-full flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-dashed border-primary/40 bg-card text-center shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-primary hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:h-80"
          >
            <span
              aria-hidden
              className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary transition duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground"
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
