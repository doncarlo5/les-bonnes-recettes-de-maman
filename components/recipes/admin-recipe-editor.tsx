"use client";

import { useActionState, useMemo, useState } from "react";
import { Save } from "lucide-react";
import type { updateRecipeAction } from "@/app/[locale]/(public)/admin/recettes/actions";
import type { Locale } from "@/i18n/config";
import type { EditableRecipe, EditableRecipeContent } from "./types";

type AdminRecipeEditorProps = {
  locale: Locale;
  recipes: EditableRecipe[];
  initialSlug?: string;
  action: typeof updateRecipeAction;
};

const initialState = {
  type: "idle" as const,
  message: "Choisis une recette, modifie le JSON, puis enregistre.",
};

export function AdminRecipeEditor({
  locale,
  recipes,
  initialSlug,
  action,
}: AdminRecipeEditorProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const initialRecipe =
    recipes.find((recipe) => recipe.slug === initialSlug) ?? recipes[0] ?? null;
  const [selectedSlug, setSelectedSlug] = useState(initialRecipe?.slug ?? "");
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.slug === selectedSlug) ?? null,
    [recipes, selectedSlug],
  );
  const [recipeJson, setRecipeJson] = useState(() =>
    initialRecipe ? stringifyEditableRecipe(initialRecipe) : "",
  );

  if (recipes.length === 0) {
    return (
      <main className="min-h-screen px-5 py-8 text-stone-900 sm:px-6">
        <section className="mx-auto w-full max-w-4xl">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-soft-peach-600">
            Admin recettes
          </p>
          <h1 className="font-heading text-5xl font-black leading-[0.95] text-stone-950">
            Aucune recette a modifier
          </h1>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8 text-stone-900 sm:px-6">
      <section className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-soft-peach-600">
            Admin recettes
          </p>
          <h1 className="font-heading text-5xl font-black leading-[0.95] text-stone-950">
            Modifier une recette
          </h1>
          <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-stone-500">
            Le JSON ci-dessous contient uniquement les champs modifiables. Les
            images et les credits existants sont conserves automatiquement.
          </p>
        </div>

        <form
          action={formAction}
          className="grid gap-6 rounded-sm bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={selectedSlug} />

          <label className="grid gap-2 text-sm font-black text-stone-700">
            Recette
            <select
              value={selectedSlug}
              onChange={(event) => {
                const nextSlug = event.target.value;
                const nextRecipe =
                  recipes.find((recipe) => recipe.slug === nextSlug) ?? null;

                setSelectedSlug(nextSlug);
                setRecipeJson(
                  nextRecipe ? stringifyEditableRecipe(nextRecipe) : "",
                );
              }}
              className="h-12 rounded-sm border border-stone-200 bg-white px-3 text-base font-semibold text-stone-900 outline-none transition focus:border-soft-peach-500 focus:ring-2 focus:ring-soft-peach-200"
            >
              {recipes.map((recipe) => (
                <option key={recipe._id} value={recipe.slug}>
                  {recipe.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-black text-stone-700">
            JSON recette
            <textarea
              name="recipeJson"
              value={recipeJson}
              onChange={(event) => setRecipeJson(event.target.value)}
              spellCheck={false}
              className="min-h-[32rem] rounded-sm border border-stone-200 bg-stone-950 p-4 font-mono text-sm leading-6 text-stone-50 outline-none transition focus:border-soft-peach-500 focus:ring-2 focus:ring-soft-peach-200"
            />
          </label>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p
              className={
                state.type === "error"
                  ? "text-sm font-bold text-red-700"
                  : state.type === "success"
                    ? "text-sm font-bold text-green-700"
                    : "text-sm font-bold text-stone-500"
              }
            >
              {state.message}
            </p>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-soft-peach-500 px-6 text-base font-black text-white transition hover:bg-soft-peach-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="size-5" />
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function stringifyEditableRecipe(recipe: EditableRecipe) {
  const content: EditableRecipeContent = {
    defaultLocale: recipe.defaultLocale,
    translations: recipe.translations,
    tags: recipe.tags,
    status: recipe.status,
  };

  return JSON.stringify(content, null, 2);
}
