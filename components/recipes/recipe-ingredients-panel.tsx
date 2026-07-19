"use client";

import { Minus, Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  formatScaledIngredient,
  getServingsFactor,
  MAX_REFERENCE_SERVINGS,
  MIN_REFERENCE_SERVINGS,
  parseSelectedServings,
} from "@/lib/recipe-servings";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { Recipe } from "./types";

type RecipeIngredientsPanelProps = {
  locale: Locale;
  dict: Dictionary;
  recipe: Recipe;
  selectedServings?: number;
  onSelectedServingsChange: (servings: number) => void;
};

export function RecipeIngredientsPanel({
  locale,
  dict,
  recipe,
  selectedServings,
  onSelectedServingsChange,
}: RecipeIngredientsPanelProps) {
  const factor = getServingsFactor(recipe.referenceServings, selectedServings);
  const ingredients = (
    <ul className="divide-y divide-border">
      {recipe.ingredients.map((ingredient, index) => (
        <li
          key={`${ingredient.name}-${ingredient.unit}-${index}`}
          className="flex items-baseline justify-between gap-4 py-3"
        >
          <span data-ingredient-name className="font-semibold text-foreground first-letter:uppercase">
            {ingredient.name}
            {ingredient.notes ? (
              <span className="mt-0.5 block text-sm font-medium italic text-muted-foreground">
                {ingredient.notes}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
            {formatScaledIngredient(ingredient, factor, locale)}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div data-ingredients-layout="mobile" className="lg:hidden">
        <div className="rounded-2xl bg-card px-4 shadow-[var(--shadow-card)]">
          <Accordion defaultValue="ingredients">
            <AccordionItem value="ingredients">
              <AccordionTrigger className="py-3 hover:no-underline">
                <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                  <span className="type-content-title text-foreground">{dict.recipeDetail.ingredients}</span>
                  <YieldLabel value={recipe.yieldLabel} />
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {recipe.referenceServings && selectedServings ? (
                  <ServingsSelector
                    dict={dict}
                    referenceServings={recipe.referenceServings}
                    value={selectedServings}
                    onChange={onSelectedServingsChange}
                    className="border-t border-border py-3"
                  />
                ) : null}
                <div className="border-t border-border">
                  {ingredients}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <div data-ingredients-layout="desktop" className="hidden rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] lg:block lg:p-7">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
          <h2 className="type-content-title text-foreground">{dict.recipeDetail.ingredients}</h2>
          <YieldLabel value={recipe.yieldLabel} />
        </div>
        {recipe.referenceServings && selectedServings ? (
          <ServingsSelector
            dict={dict}
            referenceServings={recipe.referenceServings}
            value={selectedServings}
            onChange={onSelectedServingsChange}
            className="border-b border-border py-4"
          />
        ) : null}
        {ingredients}
        {recipe.totalTime ? (
          <p className="type-label mt-6 border-t border-border pt-4 text-muted-foreground tabular-nums">
            {dict.recipeDetail.totalTime} · {recipe.totalTime}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function ServingsSelector({
  dict,
  referenceServings,
  value,
  onChange,
  className,
}: {
  dict: Dictionary;
  referenceServings: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const isDefault = value === referenceServings;
  const unit = value === 1
    ? dict.recipeDetail.servingSingular
    : dict.recipeDetail.servingPlural;

  function applyDraft(input: HTMLInputElement) {
    const next = input.value;
    const parsed = parseSelectedServings(next);
    if (parsed !== null) {
      commit(parsed);
      return;
    }
    if (/^\d+$/.test(next)) {
      commit(Math.min(MAX_REFERENCE_SERVINGS, Math.max(MIN_REFERENCE_SERVINGS, Number(next))));
      return;
    }
    input.value = String(value);
  }

  function commit(next: number) {
    onChange(next);
  }

  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-full bg-muted p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label={dict.recipeDetail.decreaseServings}
            disabled={value <= MIN_REFERENCE_SERVINGS}
            onClick={() => commit(value - 1)}
          >
            <Minus />
          </Button>
          <label className="flex items-baseline gap-1.5 px-2 font-bold tabular-nums">
            <span className="sr-only">{dict.recipeDetail.servingsLabel}</span>
            <input
              aria-label={dict.recipeDetail.servingsLabel}
              type="number"
              inputMode="numeric"
              min={MIN_REFERENCE_SERVINGS}
              max={MAX_REFERENCE_SERVINGS}
              value={value}
              onChange={(event) => applyDraft(event.currentTarget)}
              className="w-8 bg-transparent text-center outline-none"
            />
            <span className="text-sm text-muted-foreground">{unit}</span>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label={dict.recipeDetail.increaseServings}
            disabled={value >= MAX_REFERENCE_SERVINGS}
            onClick={() => commit(value + 1)}
          >
            <Plus />
          </Button>
        </div>
        {isDefault ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            {dict.recipeDetail.defaultServings}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function YieldLabel({ value }: { value: string }) {
  return value ? (
    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-sm font-semibold text-secondary-foreground tabular-nums">
      {value}
    </span>
  ) : null;
}
