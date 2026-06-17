"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Pencil } from "lucide-react";
import type {
  RecipeAdminAccessState,
  requestRecipeAdminAccessAction,
} from "@/app/[locale]/(public)/recettes/[slug]/actions";
import type { Locale } from "@/i18n/config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type EditRecipeAccessProps = {
  locale: Locale;
  slug: string;
  hasAdminAccess: boolean;
  action: typeof requestRecipeAdminAccessAction;
};

const initialState: RecipeAdminAccessState = {
  type: "idle",
  message: "",
};

export function EditRecipeAccess({
  locale,
  slug,
  hasAdminAccess,
  action,
}: EditRecipeAccessProps) {
  const adminHref = `/${locale}/admin/recettes?slug=${encodeURIComponent(slug)}`;
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (hasAdminAccess) {
    return (
      <Link
        href={adminHref}
        className="absolute left-16 top-4 z-10 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/15 px-4 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:left-24 lg:top-8 lg:h-11"
      >
        <Pencil className="size-4 stroke-[1.8]" />
        Éditer
      </Link>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        className="absolute left-16 top-4 z-10 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/15 px-4 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:left-24 lg:top-8 lg:h-11"
      >
        <Pencil className="size-4 stroke-[1.8]" />
        Éditer
      </DialogTrigger>
      <DialogContent className="rounded-2xl bg-card p-6 text-foreground sm:max-w-md">
        <DialogHeader className="">
          <DialogTitle className="font-heading text-2xl font-black text-foreground">
            Accès admin
          </DialogTitle>
          <DialogDescription className="text-sm font-semibold leading-6 text-muted-foreground">
            Entre le mot de passe pour modifier cette recette.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <label className="grid gap-2 text-sm font-black text-foreground">
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="h-12 rounded-lg border border-input bg-card px-3 text-base font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </label>
          {state.type === "error" ? (
            <p className="text-sm font-bold text-destructive">{state.message}</p>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pencil className="size-5" />
            {isPending ? "Vérification..." : "Ouvrir l'admin"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
