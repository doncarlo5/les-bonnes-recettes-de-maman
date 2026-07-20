"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Camera, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
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
import type {
  ImageMutationSuccess,
  MutationError,
} from "@/lib/recipe-admin-contracts";
import type { EditableRecipe, Recipe } from "./types";

type AdminRecipeImagePanelProps = {
  locale: Locale;
  recipe: Pick<
    EditableRecipe,
    "slug" | "title" | "heroImageUrl" | "imageCredit"
  > | null;
  revision?: number;
  compact?: boolean;
  onBeforeChange?: () => Promise<number | null>;
  onRevisionChange?: (mutation: RecipeImageMutation) => void;
  onConflict?: (
    latestRevision?: number,
    retry?: (revision: number) => Promise<void>,
  ) => void;
};

export type RecipeImageMutation = {
  revision: number;
  heroImageUrl: string;
  imageCredit?: Recipe["imageCredit"];
};

type UploadStatus =
  | { type: "idle"; message: string }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type UnsplashPhoto = {
  id: string;
  imageUrl: string;
  previewUrl: string;
  alt: string;
  photographerName: string;
  photographerUrl: string;
  photoUrl: string;
  downloadLocation: string;
};

type OpenversePhoto = {
  id: string;
  title: string;
  imageUrl: string;
  previewUrl: string;
  landingUrl: string;
  creator: string;
  creatorUrl: string;
  license: string;
  licenseVersion: string;
  licenseUrl: string;
  source: string;
  attribution: string;
  alt: string;
};

type ApiErrorResponse = {
  error?: string;
  type?: MutationError["type"];
  message?: string;
  revision?: number;
  latestRevision?: number;
};

const initialStatus: UploadStatus = {
  type: "idle",
  message: "Choisis une source pour remplacer l'image principale.",
};

const unavailableStatus: UploadStatus = {
  type: "idle",
  message: "Sauvegarde ce brouillon avant d'ajouter une image principale.",
};

async function searchUnsplash(query: string) {
  const response = await fetch(
    `/api/admin/unsplash/search?query=${encodeURIComponent(query)}`,
  );
  const data = await readJsonResponse<
    { results?: UnsplashPhoto[] } & ApiErrorResponse
  >(response);
  if (!response.ok)
    throw new Error(data.error ?? "La recherche Unsplash a échoué.");
  return data.results ?? [];
}

async function searchOpenverse(query: string) {
  const response = await fetch(
    `/api/admin/openverse/search?query=${encodeURIComponent(query)}`,
  );
  const data = await readJsonResponse<
    { results?: OpenversePhoto[] } & ApiErrorResponse
  >(response);
  if (!response.ok)
    throw new Error(data.error ?? "La recherche Openverse a échoué.");
  return data.results ?? [];
}

function handleSearchKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onSearch: () => void,
) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  onSearch();
}

export function AdminRecipeImagePanel({
  locale,
  recipe,
  revision,
  compact = false,
  onBeforeChange,
  onRevisionChange,
  onConflict,
}: AdminRecipeImagePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState(recipe?.title ?? "");
  const [unsplashResults, setUnsplashResults] = useState<UnsplashPhoto[]>([]);
  const [openverseResults, setOpenverseResults] = useState<OpenversePhoto[]>(
    [],
  );
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [status, setStatus] = useState<UploadStatus>(
    recipe ? initialStatus : unavailableStatus,
  );
  const [previewOverride, setPreviewOverride] = useState<{
    url: string;
    credit?: Recipe["imageCredit"];
  } | null>(null);
  const previewUrl = previewOverride?.url ?? recipe?.heroImageUrl ?? "";
  const previewCredit = previewOverride?.credit ?? recipe?.imageCredit;
  const [selectedUpload, setSelectedUpload] = useState<File | null>(null);
  const isDisabled = !recipe || status.type === "loading";

  function imageMutationError(
    response: Response,
    data: ApiErrorResponse,
    fallback: string,
    retry?: (revision: number) => Promise<void>,
  ) {
    if (response.status === 409 || data.type === "conflict") {
      onConflict?.(data.latestRevision, retry);
    }
    return new Error(data.message ?? data.error ?? fallback);
  }

  function applySnapshot(snapshot: ImageMutationSuccess) {
    setPreviewOverride({
      url: snapshot.heroImageUrl,
      credit: snapshot.imageCredit,
    });
    onRevisionChange?.(snapshot);
    setStatus({ type: "success", message: "Image associée et enregistrée." });
    setSelectedUpload(null);
    setIsSearchDialogOpen(false);
    toast.success("Image principale remplacée.");
  }

  async function cleanupUpload(storageId: Id<"_storage">) {
    const response = await fetch("/api/admin/recipes/cleanup-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: recipe?.slug, storageId }),
    });
    const data = await readJsonResponse<
      {
        type?: "success";
        referenced?: boolean;
        slug?: string;
        revision?: number;
        savedAt?: number;
        heroImageUrl?: string;
        imageCredit?: Recipe["imageCredit"];
      } & ApiErrorResponse
    >(response);
    if (
      response.ok &&
      data.referenced &&
      typeof data.slug === "string" &&
      data.slug === recipe?.slug &&
      typeof data.revision === "number" &&
      typeof data.savedAt === "number" &&
      typeof data.heroImageUrl === "string"
    ) {
      const snapshot: ImageMutationSuccess = {
        type: "success",
        slug: data.slug,
        revision: data.revision,
        savedAt: data.savedAt,
        heroImageUrl: data.heroImageUrl,
        imageCredit: data.imageCredit,
      };
      applySnapshot(snapshot);
      return snapshot;
    }
    return null;
  }

  async function associateStoredImage(
    storageId: Id<"_storage">,
    expectedRevision = revision,
  ) {
    let response: Response;
    try {
      response = await fetch("/api/admin/recipes/hero-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: recipe?.slug,
          storageId,
          expectedRevision,
        }),
      });
    } catch (error) {
      const recovered = await cleanupUpload(storageId);
      if (recovered) return recovered;
      throw error;
    }
    const data = await readJsonResponse<
      ImageMutationSuccess | ApiErrorResponse
    >(response);
    if (!response.ok) {
      const errorData = data as ApiErrorResponse;
      const conflict = response.status === 409 || errorData.type === "conflict";
      const latestRevision = errorData.latestRevision;
      const recovered = await cleanupUpload(storageId);
      if (recovered) return recovered;
      if (conflict)
        onConflict?.(latestRevision, (nextRevision) =>
          uploadLocalImage(fileForRetry, nextRevision),
        );
      throw new Error(
        errorData.message ??
          errorData.error ??
          "Impossible d'associer cette image.",
      );
    }
    if (
      data.type !== "success" ||
      typeof data.revision !== "number" ||
      !data.heroImageUrl
    ) {
      const recovered = await cleanupUpload(storageId);
      if (recovered) return recovered;
      throw new Error("La réponse d’image ne contient pas de révision.");
    }
    return data;
  }

  let fileForRetry: File;

  async function uploadLocalImage(file: File, expectedRevision: number) {
    fileForRetry = file;
    setStatus({ type: "loading", message: "Upload de l’image…" });
    const uploadUrlResponse = await fetch("/api/admin/recipes/upload-url", {
      method: "POST",
    });
    const uploadUrlData = await readJsonResponse<
      { uploadUrl?: string } & ApiErrorResponse
    >(uploadUrlResponse);
    if (!uploadUrlResponse.ok || !uploadUrlData.uploadUrl)
      throw new Error(
        uploadUrlData.error ??
          uploadUrlData.message ??
          "Impossible de préparer l’upload.",
      );
    const response = await fetch(uploadUrlData.uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) throw new Error("Convex Storage a refusé l’upload.");
    const { storageId } = await readJsonResponse<{ storageId: Id<"_storage"> }>(
      response,
    );
    const snapshot = await associateStoredImage(storageId, expectedRevision);
    applySnapshot(snapshot);
  }

  async function handleUploadImage(file: File | null) {
    if (!recipe || !file) {
      setStatus({
        type: "error",
        message: "Sélectionne une image avant d'uploader.",
      });
      return;
    }

    setSelectedUpload(file);
    setStatus({ type: "loading", message: "Préparation de l’image…" });
    try {
      const preparedRevision = onBeforeChange
        ? await onBeforeChange()
        : (revision ?? null);
      if (preparedRevision === null) {
        setStatus({
          type: "error",
          message: "Corrige les champs indiqués avant de remplacer l’image.",
        });
        return;
      }
      await uploadLocalImage(file, preparedRevision);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d'associer cette image.",
      });
      setSelectedUpload(null);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    await handleUploadImage(selectedFile);
  }

  async function handleInternetSearch() {
    const query = searchQuery.trim();

    if (!query) {
      setStatus({
        type: "error",
        message: "Ajoute quelques mots-clés pour chercher une image.",
      });
      return;
    }

    setIsSearchDialogOpen(true);
    setStatus({
      type: "loading",
      message: "Recherche Unsplash et Openverse en cours…",
    });

    const [unsplashResult, openverseResult] = await Promise.allSettled([
      searchUnsplash(query),
      searchOpenverse(query),
    ]);

    if (unsplashResult.status === "fulfilled") {
      setUnsplashResults(unsplashResult.value);
    } else {
      setUnsplashResults([]);
    }

    if (openverseResult.status === "fulfilled") {
      setOpenverseResults(openverseResult.value);
    } else {
      setOpenverseResults([]);
    }

    const errors = [unsplashResult, openverseResult]
      .filter((result) => result.status === "rejected")
      .map((result) =>
        result.status === "rejected" && result.reason instanceof Error
          ? result.reason.message
          : "Une recherche a échoué.",
      );

    const resultCount =
      (unsplashResult.status === "fulfilled"
        ? unsplashResult.value.length
        : 0) +
      (openverseResult.status === "fulfilled"
        ? openverseResult.value.length
        : 0);

    if (errors.length > 0) {
      setStatus({
        type: "error",
        message: errors.join(" "),
      });
      return;
    }

    setStatus({
      type: resultCount > 0 ? "success" : "idle",
      message:
        resultCount > 0
          ? `${resultCount} images trouvées.`
          : "Aucune image trouvée pour ces mots-clés.",
    });
  }

  async function handleUseUnsplashImage(
    photo: UnsplashPhoto,
    expectedRevision?: number,
    prepare = true,
  ) {
    if (!recipe) return;

    try {
      const preparedRevision =
        prepare && onBeforeChange
          ? await onBeforeChange()
          : (expectedRevision ?? revision ?? null);
      if (preparedRevision === null) {
        setStatus({
          type: "error",
          message: "Corrige les champs indiqués avant de remplacer l’image.",
        });
        return;
      }
      setStatus({
        type: "loading",
        message: "Association de l’image Unsplash…",
      });

      const trackingResponse = await fetch("/api/admin/unsplash/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadLocation: photo.downloadLocation }),
      });
      const trackingData =
        await readJsonResponse<ApiErrorResponse>(trackingResponse);

      if (!trackingResponse.ok) {
        throw new Error(trackingData.error ?? "Le tracking Unsplash a échoué.");
      }

      const imageResponse = await fetch(
        "/api/admin/recipes/unsplash-hero-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: recipe.slug,
            imageUrl: photo.imageUrl,
            alt: photo.alt,
            photographerName: photo.photographerName,
            photographerUrl: photo.photographerUrl,
            photoUrl: photo.photoUrl,
            expectedRevision: preparedRevision,
          }),
        },
      );
      const imageData = await readJsonResponse<
        ImageMutationSuccess | ApiErrorResponse
      >(imageResponse);

      if (!imageResponse.ok) {
        throw imageMutationError(
          imageResponse,
          imageData as ApiErrorResponse,
          "Impossible d'associer cette image Unsplash.",
          (nextRevision) => handleUseUnsplashImage(photo, nextRevision, false),
        );
      }
      if (
        imageData.type !== "success" ||
        typeof imageData.revision !== "number"
      ) {
        throw new Error("La réponse Unsplash ne contient pas de révision.");
      }
      applySnapshot(imageData);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d'associer cette image Unsplash.",
      });
    }
  }

  async function handleUseOpenverseImage(
    photo: OpenversePhoto,
    expectedRevision?: number,
    prepare = true,
  ) {
    if (!recipe) return;
    let importedStorageId: Id<"_storage"> | undefined;

    try {
      const preparedRevision =
        prepare && onBeforeChange
          ? await onBeforeChange()
          : (expectedRevision ?? revision ?? null);
      if (preparedRevision === null) {
        setStatus({
          type: "error",
          message: "Corrige les champs indiqués avant de remplacer l’image.",
        });
        return;
      }
      setStatus({
        type: "loading",
        message: "Import de l’image Openverse dans Convex…",
      });

      const importResponse = await fetch("/api/admin/openverse/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: photo.imageUrl }),
      });
      const imageCredit: Recipe["imageCredit"] = {
        provider: "openverse",
        title: photo.title,
        creator: photo.creator,
        creatorUrl: photo.creatorUrl || photo.landingUrl,
        imageUrl: photo.imageUrl,
        landingUrl: photo.landingUrl,
        license: photo.license,
        licenseVersion: photo.licenseVersion,
        licenseUrl: photo.licenseUrl || photo.landingUrl,
        source: photo.source,
        attribution: photo.attribution,
        alt: photo.alt,
      };
      const imported = await readJsonResponse<
        { storageId?: Id<"_storage"> } & ApiErrorResponse
      >(importResponse);
      if (!importResponse.ok || !imported.storageId)
        throw new Error(
          imported.message ?? imported.error ?? "L’import Openverse a échoué.",
        );
      importedStorageId = imported.storageId;
      const associationResponse = await fetch(
        "/api/admin/recipes/openverse-hero-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: recipe.slug,
            storageId: imported.storageId,
            imageCredit,
            expectedRevision: preparedRevision,
          }),
        },
      );
      const data = await readJsonResponse<
        ImageMutationSuccess | ApiErrorResponse
      >(associationResponse);
      if (!associationResponse.ok) {
        const errorData = data as ApiErrorResponse;
        const conflict =
          associationResponse.status === 409 || errorData.type === "conflict";
        const recovered = await cleanupUpload(imported.storageId);
        if (recovered) return;
        if (conflict)
          onConflict?.(errorData.latestRevision, (nextRevision) =>
            handleUseOpenverseImage(photo, nextRevision, false),
          );
        throw new Error(
          errorData.message ??
            errorData.error ??
            "L’association Openverse a échoué.",
        );
      }
      if (data.type !== "success")
        throw new Error("La réponse Openverse est invalide.");
      applySnapshot(data);
    } catch (error) {
      if (importedStorageId) {
        try {
          const recovered = await cleanupUpload(importedStorageId);
          if (recovered) return;
        } catch {
          // Keep the actionable association error visible; cleanup can be retried.
        }
      }
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d'associer cette image Openverse.",
      });
    }
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
              {previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUrl}
                  alt={previewCredit?.alt ?? ""}
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
          {previewCredit ? (
            <ImageCreditLine imageCredit={previewCredit} />
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
            onClick={() => setIsSearchDialogOpen(true)}
            className="min-h-11 w-full"
          >
            <Upload data-icon="inline-start" />
            Remplacer l’image
          </Button>
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
        </div>
      </div>

      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
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
          {selectedUpload ? (
            <Attachment
              className="w-full"
              state={status.type === "loading" ? "uploading" : "idle"}
            >
              <AttachmentMedia>
                <Upload />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{selectedUpload.name}</AttachmentTitle>
                <AttachmentDescription>
                  {Math.ceil(selectedUpload.size / 1024)} Ko
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  type="button"
                  aria-label="Annuler la sélection"
                  disabled={status.type === "loading"}
                  onClick={() => setSelectedUpload(null)}
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
                value={searchQuery}
                disabled={isDisabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(event.target.value)
                }
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) =>
                  handleSearchKeyDown(event, handleInternetSearch)
                }
                className="h-11 font-semibold"
                placeholder="cake citron, tarte fraise…"
              />
            </InputGroup>
            <Button
              type="button"
              size="lg"
              disabled={isDisabled}
              onClick={handleInternetSearch}
              className="min-h-11"
            >
              <Search data-icon="inline-start" />
              Chercher
            </Button>
          </div>

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

          <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))] pr-1 sm:max-h-[min(34rem,calc(100vh-13rem))]">
            <div className="grid gap-5 md:grid-cols-2">
              <ImageResultsColumn
                title="Unsplash"
                emptyMessage="Aucune image Unsplash pour cette recherche."
                isLoading={status.type === "loading"}
                hasSearched={
                  status.type !== "idle" || unsplashResults.length > 0
                }
              >
                {unsplashResults.map((photo) => (
                  <ImageChoiceCard
                    key={photo.id}
                    imageUrl={photo.previewUrl}
                    title={photo.photographerName}
                    detail="Unsplash"
                    disabled={isDisabled}
                    onSelect={() => handleUseUnsplashImage(photo)}
                  />
                ))}
              </ImageResultsColumn>

              <ImageResultsColumn
                title="Openverse"
                emptyMessage="Aucune image Openverse pour cette recherche."
                isLoading={status.type === "loading"}
                hasSearched={
                  status.type !== "idle" || openverseResults.length > 0
                }
              >
                {openverseResults.map((photo) => (
                  <ImageChoiceCard
                    key={photo.id}
                    imageUrl={photo.previewUrl}
                    title={photo.title}
                    detail={`${photo.creator} · ${formatLicense(photo)}`}
                    disabled={isDisabled}
                    onSelect={() => handleUseOpenverseImage(photo)}
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

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: response.ok
        ? "La réponse du serveur est illisible."
        : "Le serveur n'a pas renvoyé une erreur lisible.",
    } as T;
  }
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
        {formatLicense(imageCredit)}
      </a>
    </p>
  );
}

function formatLicense({
  license,
  licenseVersion,
}: {
  license: string;
  licenseVersion: string;
}) {
  return [license ? `CC ${license.toUpperCase()}` : "", licenseVersion]
    .filter(Boolean)
    .join(" ");
}
