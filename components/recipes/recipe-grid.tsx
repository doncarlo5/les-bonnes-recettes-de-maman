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
  priorityFirstImage?: boolean;
};

export function RecipeGrid({
  locale,
  dict,
  recipes,
  showAddRecipeCard = false,
  priorityFirstImage = true,
}: RecipeGridProps) {
  if (recipes.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-3">
      {recipes.map((recipe, index) => {
        const mobileTime = recipe.prepTime || recipe.cookTime;
        const mobileTimeLabel = recipe.prepTime
          ? dict.recipeDetail.prepTime
          : dict.recipeDetail.cookTime;

        return (
          <li key={recipe._id} className="h-full">
            <Link
              href={`/${locale}/recettes/${recipe.slug}`}
              className="surface-elevated group flex h-full flex-col overflow-hidden rounded-2xl bg-card text-start transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:rounded-3xl"
            >
              <span className="relative block aspect-square shrink-0 overflow-hidden rounded-t-2xl bg-muted md:aspect-[4/3] md:rounded-t-3xl">
                <Image
                  src={recipe.heroImageUrl || defaultRecipeImageUrl}
                  alt=""
                  fill
                  priority={priorityFirstImage && index === 0}
                  sizes="(max-width: 767px) 50vw, (max-width: 1279px) 50vw, 33vw"
                  className="image-outline object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                />
              </span>
              <span className="flex min-h-24 flex-1 flex-col p-3 md:block md:min-h-0 md:p-7">
                <span className="type-label mb-4 hidden items-center gap-2 text-primary tabular-nums md:inline-flex">
                  <Clock3 className="size-4 stroke-[1.8]" />
                  {recipe.timeLabel}
                </span>
                <span
                  className="type-card-title line-clamp-2 block min-h-[2.1em] max-w-[18ch] text-[1.15rem] leading-[1.05] text-foreground md:min-h-0 md:text-[clamp(1.75rem,1.25rem+2vw,3rem)]"
                  title={recipe.title}
                >
                  {recipe.title}
                </span>
                {mobileTime ? (
                  <span
                    className="mt-auto inline-flex items-center gap-1.5 pt-3 text-xs font-bold text-muted-foreground tabular-nums md:hidden"
                    aria-label={`${mobileTimeLabel}: ${mobileTime}`}
                  >
                    <Clock3 aria-hidden className="size-3.5 stroke-[1.8]" />
                    {mobileTimeLabel} · {mobileTime}
                  </span>
                ) : null}
                <span className="type-byline mt-3 hidden text-muted-foreground md:block">
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
            className="surface-elevated group flex min-h-48 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl text-center transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-80 md:gap-5 md:rounded-3xl"
          >
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-[scale,background-color,color] duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground md:size-20"
            >
              <Plus className="size-6 stroke-[1.8] md:size-10" />
            </span>
            <span className="grid gap-2 px-3 md:px-8">
              <span className="type-card-title text-[1.15rem] leading-[1.05] text-foreground md:text-[clamp(1.75rem,1.25rem+2vw,3rem)]">
                {dict.recipeList.addRecipeTitle}
              </span>
              <span className="type-body-sm hidden font-bold text-muted-foreground md:block">
                {dict.recipeList.addRecipeDescription}
              </span>
            </span>
          </Link>
        </li>
      ) : null}
    </ul>
  );
}
