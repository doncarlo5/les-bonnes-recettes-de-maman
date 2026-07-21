"use client";

import Link from "next/link";
import { Lightbulb, NotebookPen, Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TriggerVariant = "header" | "icon" | "card" | "row" | "admin";

export function RecipeCreationChooser({
  locale,
  dict,
  trigger,
  context = "public",
}: {
  locale: Locale;
  dict: Dictionary;
  trigger: TriggerVariant;
  context?: "public" | "admin";
}) {
  const fullRecipeHref = `/${locale}/admin/recettes?new=1`;
  const ideaHref =
    context === "admin"
      ? `/${locale}/admin/recettes?view=ideas&newIdea=1`
      : `/${locale}/idees#nouvelle-idee`;

  return (
    <Dialog>
      <DialogTrigger render={renderTrigger(trigger, dict)}>
        {trigger === "icon" ? null : trigger === "admin" ? (
          <>
            <Plus data-icon="inline-start" /> Nouvelle
          </>
        ) : trigger === "card" || trigger === "row" ? (
          <ChooserBody dict={dict} compact={trigger === "card"} />
        ) : (
          dict.nav.newRecipe
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-5 rounded-2xl p-5 sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle className="type-content-title">
            {dict.creationChoice.title}
          </DialogTitle>
          <DialogDescription className="type-body-sm font-semibold">
            {dict.creationChoice.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceLink
            href={fullRecipeHref}
            icon={<NotebookPen aria-hidden />}
            title={dict.creationChoice.fullTitle}
            description={dict.creationChoice.fullDescription}
          />
          <ChoiceLink
            href={ideaHref}
            icon={<Lightbulb aria-hidden />}
            title={dict.creationChoice.ideaTitle}
            description={dict.creationChoice.ideaDescription}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderTrigger(variant: TriggerVariant, dict: Dictionary) {
  if (variant === "admin") {
    return <Button type="button" className="min-h-11 rounded-xl px-4" />;
  }
  if (variant === "header") {
    return (
      <button
        type="button"
        className="inline-flex min-h-10 items-center transition-colors duration-150 hover:text-primary"
      />
    );
  }
  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label={dict.recipeList.addRecipeTitle}
        className="surface-elevated inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[scale,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96]"
      >
        <Plus aria-hidden className="size-5 stroke-[1.8]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={cn(
        "surface-elevated group w-full bg-card text-center transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "card"
          ? "flex min-h-48 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl md:min-h-80 md:gap-5 md:rounded-3xl"
          : "grid gap-4 rounded-3xl p-4 sm:grid-cols-[11rem_1fr] sm:items-center sm:text-left",
      )}
    />
  );
}

function ChooserBody({ dict, compact }: { dict: Dictionary; compact: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center bg-primary/10 text-primary transition-[scale,background-color,color] duration-300 group-hover:bg-primary group-hover:text-primary-foreground",
          compact
            ? "size-12 rounded-full group-hover:scale-105 md:size-20"
            : "aspect-[4/3] rounded-xl sm:aspect-[5/4]",
        )}
      >
        <Plus className={compact ? "size-6 stroke-[1.8] md:size-10" : "size-12 stroke-[1.8]"} />
      </span>
      <span className={cn("grid gap-2", compact ? "px-3 md:px-8" : "px-1 py-1 sm:py-3")}>
        <span className={cn("type-card-title text-foreground", compact && "type-card-title-compact")}>
          {dict.recipeList.addRecipeTitle}
        </span>
        <span className={cn("type-body-sm font-bold text-muted-foreground", compact && "hidden md:block")}>
          {dict.recipeList.addRecipeDescription}
        </span>
      </span>
    </>
  );
}

function ChoiceLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group grid min-h-40 content-start gap-3 rounded-xl bg-muted p-4 text-left transition-[scale,background-color] duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/80 active:scale-[0.98]"
    >
      <span className="grid size-10 place-items-center rounded-lg bg-background text-primary shadow-[var(--shadow-border)] [&_svg]:size-5">
        {icon}
      </span>
      <span className="type-panel-title">{title}</span>
      <span className="type-body-sm font-semibold text-muted-foreground">
        {description}
      </span>
    </Link>
  );
}
