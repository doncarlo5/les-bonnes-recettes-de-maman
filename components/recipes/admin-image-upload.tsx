"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Search, Upload } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "./types";

type AdminImageUploadProps = {
  locale: Locale;
  recipes: Recipe[];
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

export function AdminImageUpload({ locale, recipes }: AdminImageUploadProps) {
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl);
  const setHeroImage = useMutation(api.recipes.setHeroImage);
  const setUnsplashHeroImage = useMutation(api.recipes.setUnsplashHeroImage);
  const [selectedSlug, setSelectedSlug] = useState(recipes[0]?.slug ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState(recipes[0]?.title ?? "");
  const [unsplashResults, setUnsplashResults] = useState<UnsplashPhoto[]>([]);
  const [status, setStatus] = useState<UploadStatus>({
    type: "idle",
    message: "Choisis une recette et une image.",
  });

  const selectedRecipe =
    recipes.find((recipe) => recipe.slug === selectedSlug) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSlug || !file) {
      setStatus({
        type: "error",
        message: "Sélectionne une recette et une image avant d’uploader.",
      });
      return;
    }

    try {
      setStatus({ type: "loading", message: "Upload de l’image..." });

      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Convex Storage a refusé l’upload.");
      }

      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };

      await setHeroImage({ slug: selectedSlug, storageId });

      setStatus({
        type: "success",
        message:
          "Image associée. Recharge la page publique pour voir l’image Convex.",
      });
      setFile(null);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d’associer cette image.",
      });
    }
  }

  async function handleUnsplashSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
    if (!selectedSlug) return;

    try {
      setStatus({
        type: "loading",
        message: "Association de l’image Unsplash...",
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

      await setUnsplashHeroImage({
        slug: selectedSlug,
        imageUrl: photo.imageUrl,
        alt: photo.alt,
        photographerName: photo.photographerName,
        photographerUrl: photo.photographerUrl,
        photoUrl: photo.photoUrl,
      });

      setStatus({
        type: "success",
        message:
          "Image Unsplash associée. Recharge la page pour voir le nouveau fallback.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d’associer cette image Unsplash.",
      });
    }
  }

  return (
    <main className="min-h-screen bg-pale-amber-50 px-5 py-8 text-stone-900 sm:px-6">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-soft-peach-600">
            Admin images
          </p>
          <h1 className="font-heading text-5xl font-black leading-[0.95] text-stone-950">
            Images des recettes
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-stone-500">
            L’image uploadée dans Convex Storage sera utilisée en priorité. Si
            elle manque, la recette garde son fallback Unsplash choisi ici.
          </p>
        </div>

        <div className="grid gap-6 rounded-sm bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7">
          <label className="grid gap-2 text-sm font-black text-stone-700">
            Recette
            <select
              value={selectedSlug}
              onChange={(event) => {
                const nextSlug = event.target.value;
                const nextRecipe = recipes.find(
                  (recipe) => recipe.slug === nextSlug,
                );

                setSelectedSlug(nextSlug);
                setSearchQuery(nextRecipe?.title ?? "");
                setUnsplashResults([]);
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

          {selectedRecipe ? (
            <div className="grid gap-3">
              <p className="text-sm font-black text-stone-700">
                Image actuelle
              </p>
              <div className="relative aspect-[16/9] overflow-hidden rounded-sm bg-stone-100">
                <Image
                  src={selectedRecipe.heroImageUrl}
                  alt={selectedRecipe.imageCredit?.alt ?? ""}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                />
              </div>
              {selectedRecipe.imageCredit ? (
                <p className="text-xs font-bold text-stone-400">
                  Photo par{" "}
                  <a
                    href={selectedRecipe.imageCredit.photographerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-soft-peach-700 underline-offset-4 hover:underline"
                  >
                    {selectedRecipe.imageCredit.photographerName}
                  </a>{" "}
                  sur{" "}
                  <a
                    href={selectedRecipe.imageCredit.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-soft-peach-700 underline-offset-4 hover:underline"
                  >
                    Unsplash
                  </a>
                </p>
              ) : null}
              <a
                href={`/${locale}/recettes/${selectedRecipe.slug}`}
                className="text-sm font-black text-soft-peach-700 underline-offset-4 hover:underline"
              >
                Voir la recette publique
              </a>
            </div>
          ) : null}

          <form onSubmit={handleUnsplashSearch} className="grid gap-4">
            <label className="grid gap-2 text-sm font-black text-stone-700">
              Recherche Unsplash
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 min-w-0 flex-1 rounded-sm border border-stone-200 bg-white px-3 text-base font-semibold text-stone-900 outline-none transition focus:border-soft-peach-500 focus:ring-2 focus:ring-soft-peach-200"
                  placeholder="cake citron, chocolate lava cake..."
                />
                <button
                  type="submit"
                  disabled={status.type === "loading"}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-stone-950 px-5 text-base font-black text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Search className="size-5" />
                  Chercher
                </button>
              </div>
            </label>

            {unsplashResults.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {unsplashResults.map((photo) => (
                  <div
                    key={photo.id}
                    className="overflow-hidden rounded-sm border border-stone-100 bg-pale-amber-50"
                  >
                    <div className="relative aspect-[4/3] bg-stone-100">
                      <Image
                        src={photo.previewUrl}
                        alt={photo.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 384px"
                        className="object-cover"
                      />
                    </div>
                    <div className="grid gap-3 p-4">
                      <p className="text-xs font-bold text-stone-500">
                        Photo par{" "}
                        <a
                          href={photo.photographerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-soft-peach-700 underline-offset-4 hover:underline"
                        >
                          {photo.photographerName}
                        </a>
                      </p>
                      <button
                        type="button"
                        disabled={status.type === "loading"}
                        onClick={() => handleUseUnsplashImage(photo)}
                        className="h-10 rounded-full bg-soft-peach-500 px-4 text-sm font-black text-white transition hover:bg-soft-peach-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Utiliser cette image
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </form>

          <form onSubmit={handleSubmit} className="grid gap-4 border-t border-stone-100 pt-6">
            <label className="grid gap-2 text-sm font-black text-stone-700">
              Upload Convex Storage
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="rounded-sm border border-stone-200 bg-white p-3 text-sm font-semibold file:mr-4 file:rounded-full file:border-0 file:bg-soft-peach-500 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
              />
            </label>

            <button
              type="submit"
              disabled={status.type === "loading"}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-soft-peach-500 px-6 text-base font-black text-white transition hover:bg-soft-peach-600 disabled:cursor-not-allowed disabled:opacity-60 sm:justify-self-end"
            >
              <Upload className="size-5" />
              Uploader dans Convex
            </button>
          </form>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              className={
                status.type === "error"
                  ? "text-sm font-bold text-red-700"
                  : status.type === "success"
                    ? "text-sm font-bold text-green-700"
                    : "text-sm font-bold text-stone-500"
              }
            >
              {status.message}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
