"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ListChecks, MoonStar } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  buildServingsQuery,
  formatScaledIngredient,
  getServingsFactor,
  resolveSelectedServings,
} from "@/lib/recipe-servings";
import {
  createCookContentSignature,
  getCookProgressKey,
  getCookProgressStorage,
  readCookProgress,
  writeCookProgress,
  type CookProgressV1,
} from "@/lib/cook-progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Ingredient, Recipe } from "./types";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  onrelease: (() => void) | null;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export function GuidedCookMode({
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
  const effectiveServings = resolveSelectedServings(recipe.referenceServings, selectedServings);
  const servingsFactor = getServingsFactor(recipe.referenceServings, effectiveServings);
  const recipeHref = `/${locale}/recettes/${recipe.slug}${buildServingsQuery(recipe.referenceServings, effectiveServings)}`;
  const contentSignature = useMemo(() => createCookContentSignature(recipe), [recipe]);
  const storageKey = getCookProgressKey(locale, recipe.slug);
  const [progress, setProgress] = useState<CookProgressV1>(() =>
    createInitialProgress(contentSignature),
  );
  const [isReady, setIsReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [keepAwake, setKeepAwake] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const wakeLockRequestRef = useRef(0);
  const wakeLockListenerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const storage = getCookProgressStorage();
    const restored = storage
      ? readCookProgress(storage, storageKey, recipe)
      : null;
    queueMicrotask(() => {
      setProgress(restored ?? createInitialProgress(contentSignature));
      setWakeLockSupported(Boolean((navigator as NavigatorWithWakeLock).wakeLock));
      setIsReady(true);
    });
  }, [contentSignature, recipe, storageKey]);

  useEffect(() => {
    if (!isReady) return;
    const storage = getCookProgressStorage();
    if (storage) writeCookProgress(storage, storageKey, progress);
  }, [isReady, progress, storageKey]);

  const releaseWakeLock = useCallback(async () => {
    wakeLockRequestRef.current += 1;
    wakeLockListenerCleanupRef.current?.();
    wakeLockListenerCleanupRef.current = null;
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    if (sentinel) await sentinel.release().catch(() => undefined);
  }, []);

  const requestWakeLock = useCallback(async () => {
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock || wakeLockRef.current || document.visibilityState !== "visible") return;
    const requestId = ++wakeLockRequestRef.current;
    try {
      const sentinel = await wakeLock.request("screen");
      if (
        requestId !== wakeLockRequestRef.current ||
        document.visibilityState !== "visible"
      ) {
        await sentinel.release().catch(() => undefined);
        return;
      }
      wakeLockRef.current = sentinel;
      const handleRelease = () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        wakeLockListenerCleanupRef.current = null;
      };
      sentinel.onrelease = handleRelease;
      wakeLockListenerCleanupRef.current = () => { sentinel.onrelease = null; };
    } catch {
      setKeepAwake(false);
    }
  }, []);

  useEffect(() => {
    if (!keepAwake) {
      void releaseWakeLock();
      return;
    }
    queueMicrotask(() => void requestWakeLock());
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
      else void releaseWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void releaseWakeLock();
    };
  }, [keepAwake, releaseWakeLock, requestWakeLock]);

  const section = recipe.sections[progress.sectionIndex];
  const step = section?.steps[progress.stepIndex] ?? "";
  const flattened = flattenSteps(recipe);
  const currentFlatIndex = flattened.findIndex(
    (item) =>
      item.sectionIndex === progress.sectionIndex && item.stepIndex === progress.stepIndex,
  );
  const totalIngredients =
    recipe.ingredients.length +
    recipe.subRecipes.reduce((total, subRecipe) => total + subRecipe.ingredients.length, 0);

  function move(offset: -1 | 1) {
    const next = flattened[currentFlatIndex + offset];
    if (!next) {
      if (offset === 1) setIsComplete(true);
      return;
    }
    setIsComplete(false);
    setProgress((current) => ({
      ...current,
      sectionIndex: next.sectionIndex,
      stepIndex: next.stepIndex,
      updatedAt: Date.now(),
    }));
  }

  function toggleIngredient(id: string) {
    setProgress((current) => ({
      ...current,
      checkedIngredientIds: current.checkedIngredientIds.includes(id)
        ? current.checkedIngredientIds.filter((value) => value !== id)
        : [...current.checkedIngredientIds, id],
      updatedAt: Date.now(),
    }));
  }

  return (
    <main className="flex h-svh min-h-0 flex-col overflow-hidden">
      <header className="flex min-h-20 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6 lg:px-10">
        <Link
          href={recipeHref}
          aria-label={dict.cookMode.backToRecipe}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-[scale,background-color,color] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] md:min-h-10"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">{dict.cookMode.backToRecipe}</span>
        </Link>
        <p className="type-label text-center text-primary">{dict.cookMode.eyebrow}</p>
        <Button
          variant="outline"
          aria-label={`${dict.cookMode.ingredients} · ${progress.checkedIngredientIds.length}/${totalIngredients}`}
          onClick={() => setIngredientsOpen(true)}
        >
          <ListChecks data-icon="inline-start" />
          <span className="hidden sm:inline">{dict.cookMode.ingredients}</span>
          <span className="tabular-nums">{progress.checkedIngredientIds.length}/{totalIngredients}</span>
        </Button>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 content-center gap-10 overflow-y-auto overscroll-contain px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16 lg:px-10 lg:py-16">
        {isComplete ? (
          <section className="max-w-2xl">
            <span className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card">
              <Check className="size-7" />
            </span>
            <p className="type-label mb-4 text-primary">{recipe.title}</p>
            <h1 className="type-display">{dict.cookMode.completedTitle}</h1>
            <p className="type-body-spacious mt-6 max-w-xl text-pretty text-muted-foreground">
              {dict.cookMode.completedDescription}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => setIsComplete(false)}>
                <ArrowLeft data-icon="inline-start" />
                {dict.cookMode.previous}
              </Button>
              <Link
                href={recipeHref}
                className="inline-flex min-h-11 items-center rounded-lg bg-background px-4 text-sm font-semibold shadow-[0_0_0_1px_var(--border)] transition-[scale,background-color,color] duration-150 hover:bg-muted active:scale-[0.96] md:min-h-10"
              >
                {dict.cookMode.backToRecipe}
              </Link>
            </div>
          </section>
        ) : (
          <section aria-live="polite" className="max-w-3xl">
            <p className="type-label mb-4 text-primary">{section?.title}</p>
            <Progress className="mb-7" value={((currentFlatIndex + 1) / flattened.length) * 100}>
              <ProgressLabel>{dict.cookMode.eyebrow}</ProgressLabel>
              <ProgressValue>
                {format(dict.cookMode.stepCounter, {
                  current: currentFlatIndex + 1,
                  total: flattened.length,
                })}
              </ProgressValue>
            </Progress>
            <h1 className="type-page-title max-w-[22ch] text-pretty">{step}</h1>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={currentFlatIndex <= 0}
                onClick={() => move(-1)}
              >
                <ArrowLeft data-icon="inline-start" />
                {dict.cookMode.previous}
              </Button>
              <Button onClick={() => move(1)}>
                {currentFlatIndex === flattened.length - 1
                  ? dict.cookMode.finish
                  : dict.cookMode.next}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </section>
        )}

        <aside className="self-end rounded-3xl bg-card p-5 shadow-card lg:self-center">
          <div className="flex items-start gap-3">
            <MoonStar className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-semibold md:min-h-10">
                <span>{dict.cookMode.keepAwake}</span>
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={keepAwake}
                  disabled={!wakeLockSupported}
                  onChange={(event) => setKeepAwake(event.target.checked)}
                />
              </label>
              <p className="type-body-sm text-pretty text-muted-foreground">
                {!wakeLockSupported
                  ? dict.cookMode.awakeUnavailable
                  : keepAwake
                    ? dict.cookMode.awakeActive
                    : dict.cookMode.awakeInactive}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <div className="h-1 shrink-0 bg-muted" aria-hidden>
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${((currentFlatIndex + 1) / flattened.length) * 100}%` }}
        />
      </div>

      <Sheet open={ingredientsOpen} onOpenChange={setIngredientsOpen}>
        <SheetContent className="w-[min(92vw,28rem)] p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border p-6 pe-16">
            <SheetTitle className="type-panel-title">{dict.cookMode.ingredients}</SheetTitle>
            <SheetDescription className="type-body-sm">
              {format(dict.cookMode.ingredientCounter, {
                checked: progress.checkedIngredientIds.length,
                total: totalIngredients,
              })}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-6 pb-8">
            <IngredientGroup
              ingredients={recipe.ingredients}
              prefix="main"
              checked={progress.checkedIngredientIds}
              onToggle={toggleIngredient}
              factor={servingsFactor}
              locale={locale}
            />
            {recipe.subRecipes.map((subRecipe, index) => (
              <section key={subRecipe.title} className="mt-7">
                <h3 className="type-subsection-title mb-3">{subRecipe.title}</h3>
                <IngredientGroup
                  ingredients={subRecipe.ingredients}
                  prefix={`sub:${index}`}
                  checked={progress.checkedIngredientIds}
                  onToggle={toggleIngredient}
                  factor={servingsFactor}
                  locale={locale}
                />
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function IngredientGroup({
  ingredients,
  prefix,
  checked,
  onToggle,
  factor,
  locale,
}: {
  ingredients: Ingredient[];
  prefix: string;
  checked: string[];
  onToggle: (id: string) => void;
  factor: number;
  locale: Locale;
}) {
  const checkedSet = new Set(checked);
  return (
    <ul className="divide-y divide-border">
      {ingredients.map((ingredient, index) => {
        const id = `${prefix}:${index}`;
        return (
          <li key={id}>
            <label className="flex min-h-14 cursor-pointer items-center gap-4 py-2">
              <Checkbox className="" checked={checkedSet.has(id)} onCheckedChange={() => onToggle(id)} />
              <span className="type-body flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <span data-ingredient-name className="first-letter:uppercase">{ingredient.name}</span>
                <span className="shrink-0 font-semibold text-muted-foreground tabular-nums">
                  {formatScaledIngredient(ingredient, factor, locale)}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function createInitialProgress(contentSignature: string): CookProgressV1 {
  return {
    version: 1,
    contentSignature,
    sectionIndex: 0,
    stepIndex: 0,
    checkedIngredientIds: [],
    updatedAt: Date.now(),
  };
}

function flattenSteps(recipe: Recipe) {
  return recipe.sections.flatMap((section, sectionIndex) =>
    section.steps.map((_, stepIndex) => ({ sectionIndex, stepIndex })),
  );
}

function format(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}
