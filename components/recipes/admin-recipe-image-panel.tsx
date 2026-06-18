"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Upload } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/i18n/config";
import type { EditableRecipe, Recipe } from "./types";

type AdminRecipeImagePanelProps = {
  locale: Locale;
  recipe: Pick<
    EditableRecipe,
    "slug" | "title" | "heroImageUrl" | "imageCredit"
  > | null;
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

export function AdminRecipeImagePanel({
  locale,
  recipe,
}: AdminRecipeImagePanelProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState(recipe?.title ?? "");
  const [unsplashResults, setUnsplashResults] = useState<UnsplashPhoto[]>([]);
  const [openverseQuery, setOpenverseQuery] = useState(recipe?.title ?? "");
  const [openverseResults, setOpenverseResults] = useState<OpenversePhoto[]>(
    [],
  );
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

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  async function handleUploadImage() {
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
      const uploadUrlData = (await uploadUrlResponse.json()) as {
        uploadUrl?: string;
        error?: string;
      };

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

      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };

      const heroImageResponse = await fetch("/api/admin/recipes/hero-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: recipe.slug, storageId }),
      });
      const heroImageData = (await heroImageResponse.json()) as {
        error?: string;
      };

      if (!heroImageResponse.ok) {
        throw new Error(
          heroImageData.error ?? "Impossible d'associer cette image.",
        );
      }

      const objectUrl = URL.createObjectURL(file);
      setPreviewObjectUrl(objectUrl);
      setPreviewUrl(objectUrl);
      setPreviewCredit(undefined);
      setStatus({
        type: "success",
        message: "Image uploadée et associée.",
      });
      setFile(null);
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

  async function handleUnsplashSearch() {
    if (!searchQuery.trim()) {
      setStatus({
        type: "error",
        message: "Ajoute quelques mots-clés pour chercher une image.",
      });
      return;
    }

    try {
      setStatus({
        type: "loading",
        message: "Recherche Unsplash en cours...",
      });

      const response = await fetch(
        `/api/admin/unsplash/search?query=${encodeURIComponent(searchQuery)}`,
      );
      const data = (await response.json()) as {
        results?: UnsplashPhoto[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "La recherche Unsplash a échoué.");
      }

      setUnsplashResults(data.results ?? []);
      setStatus({
        type: data.results?.length ? "success" : "idle",
        message: data.results?.length
          ? `${data.results.length} images trouvées.`
          : "Aucune image trouvée pour ces mots-clés.",
      });
    } catch (error) {
      setUnsplashResults([]);
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "La recherche Unsplash a échoué.",
      });
    }
  }

  async function handleUseUnsplashImage(photo: UnsplashPhoto) {
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
      const trackingData = (await trackingResponse.json()) as {
        error?: string;
      };

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
          }),
        },
      );
      const imageData = (await imageResponse.json()) as {
        error?: string;
      };

      if (!imageResponse.ok) {
        throw new Error(
          imageData.error ?? "Impossible d'associer cette image Unsplash.",
        );
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

  async function handleOpenverseSearch() {
    if (!openverseQuery.trim()) {
      setStatus({
        type: "error",
        message: "Ajoute quelques mots-clés pour chercher une image.",
      });
      return;
    }

    try {
      setStatus({
        type: "loading",
        message: "Recherche Openverse en cours...",
      });

      const response = await fetch(
        `/api/admin/openverse/search?query=${encodeURIComponent(openverseQuery)}`,
      );
      const data = (await response.json()) as {
        results?: OpenversePhoto[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "La recherche Openverse a échoué.");
      }

      setOpenverseResults(data.results ?? []);
      setStatus({
        type: data.results?.length ? "success" : "idle",
        message: data.results?.length
          ? `${data.results.length} images Openverse trouvées.`
          : "Aucune image Openverse trouvée pour ces mots-clés.",
      });
    } catch (error) {
      setOpenverseResults([]);
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "La recherche Openverse a échoué.",
      });
    }
  }

  async function handleUseOpenverseImage(photo: OpenversePhoto) {
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
        }),
      });
      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "L'import Openverse a échoué.");
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

  function handleSearchKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    onSearch: () => void,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onSearch();
  }

  return (
    <section className="grid gap-5 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-2xl font-black text-foreground">
          Image principale
        </h3>
        <p className="text-sm font-semibold text-muted-foreground">
          Utilisée comme couverture de la recette.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="aspect-[16/9] bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={previewCredit?.alt ?? ""}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          {previewCredit ? <ImageCreditLine imageCredit={previewCredit} /> : null}
          {recipe ? (
            <a
              href={`/${locale}/recettes/${recipe.slug}`}
              className="text-sm font-black text-primary underline-offset-4 hover:underline"
            >
              Voir la recette publique
            </a>
          ) : null}
        </div>

        <div className="grid gap-5">
          {!recipe ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm font-bold text-muted-foreground">
              Sauvegarde ce brouillon avant d&apos;ajouter une image principale.
            </div>
          ) : null}

          <div className="grid gap-3">
            <label className="grid gap-2 text-sm font-black text-foreground">
              Recherche Unsplash
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  value={searchQuery}
                  disabled={isDisabled}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) =>
                    handleSearchKeyDown(event, handleUnsplashSearch)
                  }
                  className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                  placeholder="cake citron, chocolate lava cake..."
                />
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={handleUnsplashSearch}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-black text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search className="size-4" />
                  Chercher
                </button>
              </div>
            </label>

            {unsplashResults.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 border-t border-border pt-5">
            <label className="grid gap-2 text-sm font-black text-foreground">
              Recherche Openverse
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  value={openverseQuery}
                  disabled={isDisabled}
                  onChange={(event) => setOpenverseQuery(event.target.value)}
                  onKeyDown={(event) =>
                    handleSearchKeyDown(event, handleOpenverseSearch)
                  }
                  className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
                  placeholder="amandin cake, tarte fraise..."
                />
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={handleOpenverseSearch}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-black text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search className="size-4" />
                  Chercher
                </button>
              </div>
            </label>

            {openverseResults.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 border-t border-border pt-5">
            <label className="grid gap-2 text-sm font-black text-foreground">
              Upload Convex Storage
              <input
                type="file"
                accept="image/*"
                disabled={isDisabled}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="rounded-lg border border-input bg-card p-3 text-sm font-semibold file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-black file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <button
              type="button"
              disabled={isDisabled}
              onClick={handleUploadImage}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:justify-self-end"
            >
              <Upload className="size-4" />
              Uploader
            </button>
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
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="aspect-[4/3] bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="grid gap-2 p-3">
        <div className="grid gap-0.5">
          <p className="truncate text-sm font-black text-foreground">{title}</p>
          <p className="truncate text-xs font-bold text-muted-foreground">
            {detail}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onSelect}
          className="h-9 rounded-full bg-primary px-3 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Utiliser cette image
        </button>
      </div>
    </div>
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
          className="text-primary underline-offset-4 hover:underline"
        >
          {imageCredit.photographerName}
        </a>{" "}
        sur{" "}
        <a
          href={imageCredit.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
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
        className="text-primary underline-offset-4 hover:underline"
      >
        {imageCredit.creator}
      </a>{" "}
      via{" "}
      <a
        href={imageCredit.landingUrl}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline-offset-4 hover:underline"
      >
        {imageCredit.source}
      </a>{" "}
      ·{" "}
      <a
        href={imageCredit.licenseUrl}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline-offset-4 hover:underline"
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
