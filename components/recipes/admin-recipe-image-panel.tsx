"use client";

import {
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Camera, Search, Upload, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatRecipeImageLicense,
  type RecipeImageRevisionSession,
} from "./recipe-main-image-acquisition";
import type { EditableRecipe, Recipe } from "./types";
import { useRecipeMainImageAcquisition } from "./use-recipe-main-image-acquisition";

type AdminRecipeImagePanelProps = {
  locale: Locale;
  recipe: Pick<
    EditableRecipe,
    "slug" | "title" | "heroImageUrl" | "imageCredit"
  > | null;
  compact?: boolean;
  revisionSession: RecipeImageRevisionSession;
};

export function AdminRecipeImagePanel({
  locale,
  recipe,
  compact = false,
  revisionSession,
}: AdminRecipeImagePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { acquisition, state } = useRecipeMainImageAcquisition({
    recipe,
    revisionSession,
  });
  const isDisabled = !recipe || state.status.type === "loading";

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    await acquisition.uploadLocal(selectedFile);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void acquisition.search();
  }

  return (
    <section
      className={`grid gap-4 rounded-2xl bg-muted/40 p-4 shadow-[var(--shadow-card)] md:rounded-lg md:border md:border-border md:shadow-none ${compact ? "lg:sticky lg:top-28" : ""}`}
    >
      <div className="flex flex-col gap-1">
        <h2 className="type-panel-title text-foreground">Image principale</h2>
        <p className="text-sm font-semibold text-muted-foreground">
          Utilisée comme couverture de la recette.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-card)]">
            <div className="grid aspect-[16/9] place-items-center bg-muted">
              {state.preview.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={state.preview.url}
                  alt={state.preview.credit?.alt ?? ""}
                  className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                />
              ) : (
                <span className="grid place-items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Camera />
                  Aucune image
                </span>
              )}
            </div>
          </div>
          {state.preview.credit ? (
            <ImageCreditLine imageCredit={state.preview.credit} />
          ) : null}
          {recipe ? (
            <a
              href={`/${locale}/recettes/${recipe.slug}`}
              className="content-link text-sm font-black text-primary"
            >
              Voir la recette publique
            </a>
          ) : null}
        </div>

        <div className="grid content-start gap-3">
          {!recipe ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm font-bold text-muted-foreground">
              Sauvegarde ce brouillon avant d&apos;ajouter une image principale.
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isDisabled}
            onClick={() => acquisition.setDialogOpen(true)}
            className="min-h-11 w-full"
          >
            <Upload data-icon="inline-start" />
            Remplacer l’image
          </Button>
          <StatusMessage status={state.status} />
        </div>
      </div>

      <Dialog
        open={state.isDialogOpen}
        onOpenChange={acquisition.setDialogOpen}
      >
        <DialogContent className="inset-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <DialogHeader className="">
            <DialogTitle className="">Remplacer l’image principale</DialogTitle>
            <DialogDescription className="">
              Choisis une image pour remplacer l&apos;image principale de
              recette.
            </DialogDescription>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            aria-label="Choisir une image sur cet appareil"
            accept="image/*"
            disabled={isDisabled}
            onChange={handleFileChange}
            className="sr-only"
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isDisabled}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-11 justify-self-start"
          >
            <Upload data-icon="inline-start" />
            Choisir un fichier
          </Button>
          {state.selectedUpload ? (
            <Attachment
              className="w-full"
              state={state.status.type === "loading" ? "uploading" : "idle"}
            >
              <AttachmentMedia>
                <Upload />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{state.selectedUpload.name}</AttachmentTitle>
                <AttachmentDescription>
                  {Math.ceil(state.selectedUpload.size / 1024)} Ko
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  type="button"
                  aria-label="Annuler la sélection"
                  disabled={state.status.type === "loading"}
                  onClick={acquisition.clearSelectedUpload}
                >
                  <X />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ) : null}

          <div className="h-px bg-border" />

          <div className="flex flex-col gap-3 pr-8 sm:flex-row">
            <InputGroup className="h-11 flex-1 bg-card">
              <InputGroupAddon>
                <Search aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="Mots-clés de recherche d'image"
                value={state.searchQuery}
                disabled={isDisabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  acquisition.setSearchQuery(event.target.value)
                }
                onKeyDown={handleSearchKeyDown}
                className="h-11 font-semibold"
                placeholder="cake citron, tarte fraise…"
              />
            </InputGroup>
            <Button
              type="button"
              size="lg"
              disabled={isDisabled}
              onClick={() => void acquisition.search()}
              className="min-h-11"
            >
              <Search data-icon="inline-start" />
              Chercher
            </Button>
          </div>

          <StatusMessage status={state.status} />

          <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] pr-1 sm:max-h-[min(34rem,calc(100vh-13rem))]">
            <div className="grid gap-5 md:grid-cols-2">
              <ImageResultsColumn
                title="Unsplash"
                emptyMessage="Aucune image Unsplash pour cette recherche."
                isLoading={state.status.type === "loading"}
                hasSearched={
                  state.status.type !== "idle" ||
                  state.candidates.unsplash.length > 0
                }
              >
                {state.candidates.unsplash.map((candidate) => (
                  <ImageChoiceCard
                    key={candidate.key}
                    imageUrl={candidate.previewUrl}
                    title={candidate.title}
                    detail={candidate.detail}
                    disabled={isDisabled}
                    onSelect={() =>
                      void acquisition.selectCandidate(candidate.key)
                    }
                  />
                ))}
              </ImageResultsColumn>

              <ImageResultsColumn
                title="Openverse"
                emptyMessage="Aucune image Openverse pour cette recherche."
                isLoading={state.status.type === "loading"}
                hasSearched={
                  state.status.type !== "idle" ||
                  state.candidates.openverse.length > 0
                }
              >
                {state.candidates.openverse.map((candidate) => (
                  <ImageChoiceCard
                    key={candidate.key}
                    imageUrl={candidate.previewUrl}
                    title={candidate.title}
                    detail={candidate.detail}
                    disabled={isDisabled}
                    onSelect={() =>
                      void acquisition.selectCandidate(candidate.key)
                    }
                  />
                ))}
              </ImageResultsColumn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatusMessage({
  status,
}: {
  status: {
    type: "idle" | "loading" | "success" | "error";
    message: string;
  };
}) {
  return (
    <p
      className={
        status.type === "error"
          ? "text-sm font-bold text-destructive"
          : status.type === "success"
            ? "text-sm font-bold text-success"
            : "text-sm font-bold text-muted-foreground"
      }
    >
      {status.message}
    </p>
  );
}

function ImageResultsColumn({
  title,
  emptyMessage,
  isLoading,
  hasSearched,
  children,
}: {
  title: string;
  emptyMessage: string;
  isLoading: boolean;
  hasSearched: boolean;
  children: ReactNode;
}) {
  const hasResults = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <section className="grid content-start gap-3">
      <h3 className="type-panel-title text-foreground">{title}</h3>
      {hasResults ? (
        <div className="grid grid-cols-2 gap-3">{children}</div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3" aria-label="Recherche en cours">
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="aspect-[4/3] rounded-xl" />
        </div>
      ) : (
        <Empty className="min-h-40 bg-muted/40">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>
              {hasSearched ? emptyMessage : "Lance une recherche"}
            </EmptyTitle>
            <EmptyDescription>
              {hasSearched
                ? "Essaie avec d’autres mots-clés."
                : "Les résultats Unsplash et Openverse apparaîtront ici."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}

function ImageChoiceCard({
  imageUrl,
  title,
  detail,
  disabled,
  onSelect,
}: {
  imageUrl: string;
  title: string;
  detail: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="group grid min-h-11 overflow-hidden rounded-xl bg-card text-left shadow-[var(--shadow-card)] transition-[scale,box-shadow,opacity] duration-150 hover:shadow-[var(--shadow-card-hover)] focus-visible:ring-3 focus-visible:ring-ring/80 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="aspect-[4/3] bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 transition-transform duration-150 group-hover:scale-[1.02] dark:outline-white/10"
        />
      </div>
      <div className="grid gap-0.5 p-2">
        <p className="type-meta truncate text-foreground" title={title}>
          {title}
        </p>
        <p className="type-meta truncate text-muted-foreground" title={detail}>
          {detail}
        </p>
      </div>
    </button>
  );
}

function ImageCreditLine({
  imageCredit,
}: {
  imageCredit: NonNullable<Recipe["imageCredit"]>;
}) {
  if (imageCredit.provider === "unsplash") {
    return (
      <p className="text-xs font-bold text-muted-foreground">
        Photo par{" "}
        <a
          href={imageCredit.photographerUrl}
          target="_blank"
          rel="noreferrer"
          className="content-link text-primary"
        >
          {imageCredit.photographerName}
        </a>{" "}
        sur{" "}
        <a
          href={imageCredit.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="content-link text-primary"
        >
          Unsplash
        </a>
      </p>
    );
  }

  return (
    <p className="text-xs font-bold text-muted-foreground">
      Photo par{" "}
      <a
        href={imageCredit.creatorUrl}
        target="_blank"
        rel="noreferrer"
        className="content-link text-primary"
      >
        {imageCredit.creator}
      </a>{" "}
      via{" "}
      <a
        href={imageCredit.landingUrl}
        target="_blank"
        rel="noreferrer"
        className="content-link text-primary"
      >
        {imageCredit.source}
      </a>{" "}
      ·{" "}
      <a
        href={imageCredit.licenseUrl}
        target="_blank"
        rel="noreferrer"
        className="content-link text-primary"
      >
        {formatRecipeImageLicense(imageCredit)}
      </a>
    </p>
  );
}
