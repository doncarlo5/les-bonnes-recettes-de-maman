"use client";

import type { ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Send, Trash2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  getPublicationState,
  type RecipeReadiness,
} from "@/lib/recipe-admin-domain";
import type { EditableRecipe } from "./types";

export function PublishWorkspace({
  recipe,
  readiness,
  publication,
  isPending,
  onPublish,
  onDiscard,
  onDelete,
  onUnpublish,
}: {
  recipe: EditableRecipe | null;
  readiness: RecipeReadiness;
  publication: ReturnType<typeof getPublicationState>;
  isPending: boolean;
  onPublish: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  onUnpublish: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  function openItem(item: (typeof readiness.blockers)[number]) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", item.section);
    params.set("lang", item.locale);
    params.set("field", item.field);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="grid gap-5">
      <div>
        <p className="type-label text-primary">État de préparation</p>
        <h2 className="type-panel-title mt-2">Avant de publier</h2>
        <p className="type-body-sm mt-2 font-semibold text-muted-foreground [text-wrap:pretty]">
          {publication.isPublic
            ? "La version approuvée est visible publiquement."
            : publication.hasPublishedVersion
              ? "La version approuvée est actuellement masquée."
              : "Cette recette n’a jamais été publiée."}
        </p>
      </div>
      {readiness.blockers.length ? (
        <div className="grid gap-2">
          <h3 className="font-black text-destructive">À compléter</h3>
          {readiness.blockers.map((item) => (
            <button
              type="button"
              key={item.code}
              onClick={() => openItem(item)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-destructive/10 p-3 text-left text-sm font-bold text-destructive transition-[scale,background-color] active:scale-[0.96]"
            >
              <TriangleAlert className="size-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="size-5" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 rounded-xl bg-success/10 p-4 font-bold text-success">
          <Check className="size-5" />
          La version française est prête.
        </div>
      )}
      {readiness.warnings.length ? (
        <div className="grid gap-2">
          <h3 className="font-black">Conseils</h3>
          {readiness.warnings.map((item) => (
            <button
              type="button"
              key={item.code}
              onClick={() => openItem(item)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-muted p-3 text-left text-sm font-semibold transition-[scale,background-color] active:scale-[0.96]"
            >
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="size-5" />
            </button>
          ))}
        </div>
      ) : null}
      {publication.isPublic && recipe ? (
        <a
          href={`../recettes/${recipe.slug}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center rounded-xl bg-muted px-4 font-black"
        >
          Voir la version publiée
        </a>
      ) : null}
      <Button
        type="button"
        size="lg"
        disabled={isPending || readiness.blockers.length > 0}
        onClick={onPublish}
        className="min-h-12 rounded-xl transition-transform active:scale-[0.96]"
      >
        {isPending ? <Spinner /> : <Send />}{" "}
        {publication.hasPublishedVersion
          ? "Publier les modifications"
          : "Publier la recette"}
      </Button>
      {recipe ? (
        <div className="grid gap-3 border-t border-border pt-5">
          <div>
            <h3 className="font-black text-destructive">Zone dangereuse</h3>
            <p className="mt-1 text-sm font-semibold text-muted-foreground [text-wrap:pretty]">
              Ces actions retirent du contenu ou annulent des modifications. La
              suppression est définitive.
            </p>
          </div>
          {publication.canDiscard ? (
            <ConfirmRecipeAction
              title="Abandonner les modifications ?"
              description="Le brouillon sera remplacé par la dernière version publiée."
              confirmLabel="Abandonner"
              onConfirm={onDiscard}
            >
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="min-h-11 rounded-xl"
              >
                Abandonner les modifications
              </Button>
            </ConfirmRecipeAction>
          ) : null}
          {publication.isPublic ? (
            <ConfirmRecipeAction
              title="Retirer la recette du site ?"
              description="La version publiée sera masquée, mais elle ne sera pas supprimée."
              confirmLabel="Retirer du site"
              onConfirm={onUnpublish}
            >
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="min-h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Retirer du site public
              </Button>
            </ConfirmRecipeAction>
          ) : null}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  className="min-h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                />
              }
            >
              <Trash2 /> Supprimer la recette
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer « {recipe.title} » ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. La version publiée, le
                  brouillon, les images et les commentaires associés seront
                  supprimés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isPending}
                >
                  {isPending ? <Spinner /> : <Trash2 />} Supprimer
                  définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </div>
  );
}

function ConfirmRecipeAction({
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  children: ReactElement;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={children} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
