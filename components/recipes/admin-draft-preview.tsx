"use client";

import { ArrowLeft } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Button } from "@/components/ui/button";
import type { RecipeDraftPayload } from "./recipe-form-schema";
import { RecipePresentation } from "./recipe-detail-page";
import type { EditableRecipe, Recipe } from "./types";

type PreviewLocale = "fr" | "en";
type PreviewSection =
  | "info"
  | "details"
  | "ingredients"
  | "preparation"
  | "notes"
  | "translation";

export function AdminDraftPreview({
  dictionaries,
  recipe,
  values,
  previewLocale,
  onClose,
  onPreviewLanguage,
  onReturnToSection,
}: {
  dictionaries: Record<PreviewLocale, Dictionary>;
  recipe: EditableRecipe;
  values: RecipeDraftPayload;
  previewLocale: PreviewLocale;
  onClose: () => void;
  onPreviewLanguage: (locale: PreviewLocale) => void;
  onReturnToSection: (section: PreviewSection) => void;
}) {
  const localized = values.translations[previewLocale];
  const previewRecipe: Recipe = {
    _id: recipe._id,
    _creationTime: recipe._creationTime,
    slug: recipe.slug,
    heroImageUrl: recipe.heroImageUrl,
    imageCredit: recipe.imageCredit,
    defaultLocale: values.defaultLocale,
    referenceServings: values.referenceServings,
    relatedRecipes: values.relatedRecipeSlugs.map((slug) => ({
      slug,
      title: slug,
    })),
    categories: values.categories,
    status: recipe.status,
    ...localized,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
        <Button
          type="button"
          variant="ghost"
          aria-label="Retour à l’édition"
          onClick={onClose}
        >
          <ArrowLeft data-icon="inline-start" />
          <span className="hidden sm:inline">Retour à l’édition</span>
        </Button>
        <div className="flex items-center gap-2">
          <p className="type-label text-primary">Aperçu du brouillon</p>
          <Button
            type="button"
            variant={previewLocale === "fr" ? "default" : "outline"}
            onClick={() => onPreviewLanguage("fr")}
          >
            Français
          </Button>
          <Button
            type="button"
            variant={previewLocale === "en" ? "default" : "outline"}
            onClick={() => onPreviewLanguage("en")}
          >
            Anglais
          </Button>
        </div>
        <nav
          aria-label="Modifier une section"
          className="flex w-full gap-2 overflow-x-auto pb-1"
        >
          {(
            [
              ["info", "Informations"],
              ["details", "Détails"],
              ["ingredients", "Ingrédients"],
              ["preparation", "Préparation"],
              ["notes", "Notes"],
              ["translation", "Traduction"],
            ] as const
          ).map(([section, label]) => (
            <Button
              key={section}
              type="button"
              variant="ghost"
              className="shrink-0"
              onClick={() => onReturnToSection(section)}
            >
              {label}
            </Button>
          ))}
        </nav>
      </header>
      <RecipePresentation
        locale={previewLocale}
        dict={dictionaries[previewLocale]}
        recipe={previewRecipe}
        mode="preview"
      />
    </div>
  );
}
