"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw, UtensilsCrossed } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  getCookProgressKey,
  getCookProgressStorage,
  readCookProgress,
  removeCookProgress,
} from "@/lib/cook-progress";
import { buildServingsQuery } from "@/lib/recipe-servings";
import type { Recipe } from "./types";

export function CookModeEntry({
  locale,
  dict,
  recipe,
  selectedServings,
}: {
  locale: Locale;
  dict: Dictionary;
  recipe: Recipe;
  selectedServings?: number;
}) {
  const [hasProgress, setHasProgress] = useState(false);
  const key = getCookProgressKey(locale, recipe.slug);
  const servingsQuery = buildServingsQuery(recipe.referenceServings, selectedServings);
  const href = `/${locale}/recettes/${recipe.slug}/cuisiner${servingsQuery}`;

  useEffect(() => {
    queueMicrotask(() => {
      const storage = getCookProgressStorage();
      setHasProgress(Boolean(storage && readCookProgress(storage, key, recipe)));
    });
  }, [key, recipe]);

  function resetProgress() {
    const storage = getCookProgressStorage();
    if (storage) removeCookProgress(storage, key);
    setHasProgress(false);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-card transition-[scale,background-color] duration-150 hover:bg-primary/90 active:scale-[0.96] md:min-h-10"
      >
        <UtensilsCrossed className="size-4" />
        {hasProgress ? dict.recipeDetail.resumeCooking : dict.recipeDetail.startCooking}
      </Link>
      {hasProgress ? (
        <button
          type="button"
          onClick={resetProgress}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-muted-foreground shadow-[0_0_0_1px_var(--border)] transition-[scale,background-color,color] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] md:min-h-10"
        >
          <RotateCcw className="size-4" />
          {dict.recipeDetail.startOver}
        </button>
      ) : null}
    </div>
  );
}
