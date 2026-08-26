"use client";

import { Trash2 } from "lucide-react";
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
import type { EditableRecipe } from "./types";

export function DeleteRecipeControl({
  recipe,
  isPending,
  onDelete,
  variant = "button",
  open,
  onOpenChange,
}: {
  recipe: EditableRecipe;
  isPending: boolean;
  onDelete: () => void;
  variant?: "button" | "hidden";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {variant === "button" ? (
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
      ) : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {recipe.title} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. La version publiée, les modifications privées,
            les images et les commentaires associés seront supprimés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onDelete}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : <Trash2 />} Supprimer définitivement
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
