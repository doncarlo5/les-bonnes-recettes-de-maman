"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Upload } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EditableRecipe, Recipe } from "./types";

type AdminRecipeImagePanelProps = {
  locale: Locale;
  recipe: Pick<
    EditableRecipe,
    "slug" | "title" | "heroImageUrl" | "imageCredit"
  > | null;
  revision?: number;
  onRevisionChange?: (revision: number) => void;
  onConflict?: (latestRevision?: number, retry?: (revision: number) => Promise<void>) => void;
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
  type?: "success" | "error" | "conflict";
  message?: string;
  revision?: number;
  latestRevision?: number;
};

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

const initialStatus: UploadStatus = {
  type: "idle",
  message: "Choisis une source pour remplacer l'image principale.",
};

const unavailableStatus: UploadStatus = {
  type: "idle",
  message: "Sauvegarde ce brouillon avant d'ajouter une image principale.",
};

async function searchUnsplash(query: string) {
  const response = await fetch(`/api/admin/unsplash/search?query=${encodeURIComponent(query)}`);
  const data = await readJsonResponse<{ results?: UnsplashPhoto[] } & ApiErrorResponse>(response);
  if (!response.ok) throw new Error(data.error ?? "La recherche Unsplash a échoué.");
  return data.results ?? [];
}

async function searchOpenverse(query: string) {
  const response = await fetch(`/api/admin/openverse/search?query=${encodeURIComponent(query)}`);
  const data = await readJsonResponse<{ results?: OpenversePhoto[] } & ApiErrorResponse>(response);
  if (!response.ok) throw new Error(data.error ?? "La recherche Openverse a échoué.");
  return data.results ?? [];
}

function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>, onSearch: () => void) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  onSearch();
}

export function AdminRecipeImagePanel({
  locale,
  recipe,
  revision,
  onRevisionChange,
  onConflict,
}: AdminRecipeImagePanelProps) {
  const router = useRouter();
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
  const [previewUrl, setPreviewUrl] = useState(
    recipe?.heroImageUrl || defaultRecipeImageUrl,
  );
  const [previewCredit, setPreviewCredit] = useState<Recipe["imageCredit"]>(
    recipe?.imageCredit,
  );
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const isDisabled = !recipe || status.type === "loading";

  function imageMutationError(response: Response, data: ApiErrorResponse, fallback: string, retry?: (revision: number) => Promise<void>) {
    if (response.status === 409 || data.type === "conflict") {
      onConflict?.(data.latestRevision, retry);
    }
    return new Error(data.message ?? data.error ?? fallback);
  }

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  async function associateStoredImage(storageId: Id<"_storage">, expectedRevision = revision) {
    const response = await fetch("/api/admin/recipes/hero-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: recipe?.slug, storageId, expectedRevision }),
    });
    const data = await readJsonResponse<ApiErrorResponse>(response);
    if (!response.ok) {
      throw imageMutationError(response, data, "Impossible d'associer cette image.", (nextRevision) => associateStoredImage(storageId, nextRevision));
    }
    if (typeof data.revision === "number") onRevisionChange?.(data.revision);
  }

  async function handleUploadImage(file: File | null) {
    if (!recipe || !file) {
      setStatus({
        type: "error",
        message: "Sélectionne une image avant d'uploader.",
      });
      return;
    }

    try {
      setStatus({ type: "loading", message: "Upload de l'image..." });

      const uploadUrlResponse = await fetch("/api/admin/recipes/upload-url", {
        method: "POST",
      });
      const uploadUrlData = await readJsonResponse<
        { uploadUrl?: string } & ApiErrorResponse
      >(uploadUrlResponse);

      if (!uploadUrlResponse.ok || !uploadUrlData.uploadUrl) {
        throw new Error(
          uploadUrlData.error ?? "Impossible de preparer l'upload.",
        );
      }

      const response = await fetch(uploadUrlData.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Convex Storage a refuse l'upload.");
      }

      const { storageId } = await readJsonResponse<{
        storageId: Id<"_storage">;
      }>(response);

      await associateStoredImage(storageId);

      const objectUrl = URL.createObjectURL(file);
      setPreviewObjectUrl(objectUrl);
      setPreviewUrl(objectUrl);
      setPreviewCredit(undefined);
      setStatus({
        type: "success",
        message: "Image uploadée et associée.",
      });
      router.refresh();
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d'associer cette image.",
      });
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
      message: "Recherche Unsplash et Openverse en cours...",
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
      (unsplashResult.status === "fulfilled" ? unsplashResult.value.length : 0) +
      (openverseResult.status === "fulfilled" ? openverseResult.value.length : 0);

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

  async function handleUseUnsplashImage(photo: UnsplashPhoto, expectedRevision = revision) {
    if (!recipe) return;

    try {
      setStatus({
        type: "loading",
        message: "Association de l'image Unsplash...",
      });

      const trackingResponse = await fetch("/api/admin/unsplash/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadLocation: photo.downloadLocation }),
      });
      const trackingData =
        await readJsonResponse<ApiErrorResponse>(trackingResponse);

      if (!trackingResponse.ok) {
        throw new Error(
          trackingData.error ?? "Le tracking Unsplash a échoué.",
        );
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
            expectedRevision,
          }),
        },
      );
      const imageData =
        await readJsonResponse<ApiErrorResponse>(imageResponse);

      if (!imageResponse.ok) {
        throw imageMutationError(imageResponse, imageData, "Impossible d'associer cette image Unsplash.", (nextRevision) => handleUseUnsplashImage(photo, nextRevision));
      }
      if (typeof (imageData as ApiErrorResponse & { revision?: number }).revision === "number") {
        onRevisionChange?.((imageData as ApiErrorResponse & { revision: number }).revision);
      }

      setPreviewUrl(photo.imageUrl);
      setPreviewCredit({
        provider: "unsplash",
        photographerName: photo.photographerName,
        photographerUrl: photo.photographerUrl,
        photoUrl: photo.photoUrl,
        alt: photo.alt,
      });
      setStatus({
        type: "success",
        message: "Image Unsplash associée.",
      });
      setIsSearchDialogOpen(false);
      router.refresh();
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

  async function handleUseOpenverseImage(photo: OpenversePhoto, expectedRevision = revision) {
    if (!recipe) return;

    try {
      setStatus({
        type: "loading",
        message: "Import de l'image Openverse dans Convex...",
      });

      const response = await fetch("/api/admin/openverse/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: recipe.slug,
          imageUrl: photo.imageUrl,
          title: photo.title,
          creator: photo.creator,
          creatorUrl: photo.creatorUrl,
          landingUrl: photo.landingUrl,
          license: photo.license,
          licenseVersion: photo.licenseVersion,
          licenseUrl: photo.licenseUrl,
          source: photo.source,
          attribution: photo.attribution,
          alt: photo.alt,
          expectedRevision,
        }),
      });
      const data = await readJsonResponse<ApiErrorResponse>(response);

      if (!response.ok) {
        throw imageMutationError(response, data, "L'import Openverse a échoué.", (nextRevision) => handleUseOpenverseImage(photo, nextRevision));
      }
      if (typeof (data as ApiErrorResponse & { revision?: number }).revision === "number") {
        onRevisionChange?.((data as ApiErrorResponse & { revision: number }).revision);
      }

      setPreviewUrl(photo.imageUrl);
      setPreviewCredit({
        provider: "openverse",
        title: photo.title,
        creator: photo.creator,
        creatorUrl: photo.creatorUrl,
        imageUrl: photo.imageUrl,
        landingUrl: photo.landingUrl,
        license: photo.license,
        licenseVersion: photo.licenseVersion,
        licenseUrl: photo.licenseUrl,
        source: photo.source,
        attribution: photo.attribution,
        alt: photo.alt,
      });
      setStatus({
        type: "success",
        message: "Image Openverse importée et associée.",
      });
      setIsSearchDialogOpen(false);
      router.refresh();
    } catch (error) {
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
    <section className="grid gap-5 rounded-2xl bg-muted/40 p-4 shadow-[var(--shadow-card)] md:rounded-lg md:border md:border-border md:shadow-none">
      <div className="flex flex-col gap-1">
        <h3 className="type-panel-title text-foreground">
          Image principale
        </h3>
        <p className="text-sm font-semibold text-muted-foreground">
          Utilisée comme couverture de la recette.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-card)]">
            <div className="aspect-[16/9] bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={previewCredit?.alt ?? ""}
                className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              />
            </div>
          </div>
          {previewCredit ? <ImageCreditLine imageCredit={previewCredit} /> : null}
          {recipe ? (
            <a
              href={`/${locale}/recettes/${recipe.slug}`}
              className="content-link text-sm font-black text-primary"
            >
              Voir la recette publique
            </a>
          ) : null}
        </div>

        <div className="grid content-start gap-4">
          {!recipe ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm font-bold text-muted-foreground">
              Sauvegarde ce brouillon avant d&apos;ajouter une image principale.
            </div>
          ) : null}

          <div className="grid gap-2">
            <label
              htmlFor="recipe-image-search-query"
              className="text-sm font-black text-foreground"
            >
              Rechercher une image
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="recipe-image-search-query"
                type="search"
                value={searchQuery}
                disabled={isDisabled}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) =>
                  handleSearchKeyDown(event, handleInternetSearch)
                }
                className="h-11 flex-1 bg-card font-semibold"
                placeholder="cake citron, tarte fraise..."
              />
              <Button
                type="button"
                size="lg"
                disabled={isDisabled}
                onClick={handleInternetSearch}
                className="min-h-11"
              >
                <Search data-icon="inline-start" />
                Chercher sur internet
              </Button>
            </div>
          </div>

          <div className="grid gap-2 border-t border-border pt-4">
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
              Upload a file
            </Button>
          </div>

          <p
            className={
              status.type === "error"
                ? "text-sm font-bold text-destructive"
                : status.type === "success"
                  ? "text-sm font-bold text-green-600 dark:text-green-400"
                  : "text-sm font-bold text-muted-foreground"
            }
          >
            {status.message}
          </p>
        </div>
      </div>

      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="inset-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none sm:inset-1/2 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <DialogHeader className="">
            <DialogTitle className="">Recherche internet</DialogTitle>
            <DialogDescription className="">
              Choisis une image pour remplacer l&apos;image principale de recette.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pr-8 sm:flex-row">
            <Input
              type="search"
              aria-label="Mots-clés de recherche d'image"
              value={searchQuery}
              disabled={isDisabled}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) =>
                handleSearchKeyDown(event, handleInternetSearch)
              }
              className="h-11 flex-1 bg-card font-semibold"
              placeholder="cake citron, tarte fraise..."
            />
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
                  ? "text-sm font-bold text-green-600 dark:text-green-400"
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
      <h4 className="type-panel-title text-foreground">
        {title}
      </h4>
      {hasResults ? (
        <div className="grid grid-cols-2 gap-3">{children}</div>
      ) : (
        <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm font-bold text-muted-foreground">
          {isLoading
            ? "Recherche en cours..."
            : hasSearched
              ? emptyMessage
              : "Lance une recherche pour voir les images."}
        </div>
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
      className="group grid min-h-11 overflow-hidden rounded-xl bg-card text-left shadow-[var(--shadow-card)] transition-[scale,box-shadow,opacity] duration-150 hover:shadow-[var(--shadow-card-hover)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
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
        <p className="type-meta truncate text-foreground" title={title}>{title}</p>
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
