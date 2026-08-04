"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Camera,
  Check,
  Edit3,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Replace,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { Recipe } from "./types";
import { uploadRecipeMakePhoto } from "@/lib/recipe-make-photo-upload";

type ReportReason = "spam" | "inappropriate" | "privacy" | "copyright" | "other";

type MakeItem = {
  _id: string;
  _creationTime: number;
  authorName: string | null;
  caption: string | null;
  altText: string | null;
  fullPhotoUrl: string | null;
  thumbnailUrl: string | null;
  isAuthor: boolean;
  viewerHasBravo: boolean;
  viewerHasReported: boolean;
  bravoCount: number;
  reportCount: number;
  canEdit: boolean;
  canReport: boolean;
  edited: boolean;
};

type MakesQueryResult = {
  page: MakeItem[];
  continueCursor: string;
  isDone: boolean;
  resultsCount: number;
};

type MakesPreviewResult = {
  page: MakeItem[];
  hasMore: boolean;
  resultsCount: number;
};

type MakeMutation =
  | { action: "requestTicket"; slug: string; makeIdToReplace?: string }
  | { action: "update"; makeId: string; authorName?: string; caption?: string; altText?: string }
  | { action: "delete"; makeId: string }
  | { action: "toggleBravo"; makeId: string }
  | { action: "report"; makeId: string; reason: ReportReason; details?: string };

type QueryState = "idle" | "loading" | "submitting" | "uploading";

type ReportDraft = {
  makeId: string;
  reason: ReportReason;
  details: string;
};

export function RecipeComments({ locale, dict, recipe, openComposer = false }: { locale: Locale; dict: Dictionary; recipe: Recipe; openComposer?: boolean }) {
  const labels = dict.recipeDetail.makes;
  const [previewItems, setPreviewItems] = useState<MakeItem[]>([]);
  const [galleryItems, setGalleryItems] = useState<MakeItem[]>([]);
  const galleryCursorRef = useRef<string | null>(null);
  const [galleryDone, setGalleryDone] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(openComposer);
  const [editingMakeId, setEditingMakeId] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [caption, setCaption] = useState("");
  const [altText, setAltText] = useState("");
  const selectedPhotoRef = useRef<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [queryState, setQueryState] = useState<QueryState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lightboxMake, setLightboxMake] = useState<MakeItem | null>(null);
  const [reportDialog, setReportDialog] = useState<ReportDraft | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const countLabel = useMemo(
    () => (totalCount === 1 ? labels.countSingular : labels.countPlural).replace("{count}", String(totalCount)),
    [labels.countPlural, labels.countSingular, totalCount],
  );

  const isSubmitting = queryState === "submitting" || queryState === "uploading";

  const removePhotoPreview = useCallback(() => {
    selectedPhotoRef.current = null;
    setPhotoPreview(null);
    setHasPhoto(false);
  }, []);

  const clearComposer = useCallback(() => {
    setEditingMakeId(null);
    setAuthorName("");
    setCaption("");
    setAltText("");
    setHasPhoto(false);
    removePhotoPreview();
    setFormError(null);
    setSubmitError(null);
  }, [removePhotoPreview]);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    clearComposer();
  }, [clearComposer]);

  const makeApiUrl = useCallback((scope: "preview" | "gallery", cursor?: string | null) => {
    const params = new URLSearchParams({ slug: recipe.slug, scope });
    if (cursor) params.set("cursor", cursor);
    return `/api/recipes/makes?${params.toString()}`;
  }, [recipe.slug]);

  const mapApiError = useCallback((errorText: string) => {
    if (errorText.includes("RECIPE_MAKE_RATE_LIMITED")) return labels.rateLimited;
    if (errorText.includes("RECIPE_MAKE_UPLOAD_DISABLED")) return labels.uploadDisabled;
    if (errorText.includes("RECIPE_MAKE_PARTICIPANT_BLOCKED")) return labels.participantBlocked;
    return labels.error;
  }, [labels]);

  const requestApi = useCallback(async <T,>(url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    if (!response.ok) {
      const rawBody = await response.json().catch(() => ({}));
      const error = typeof rawBody === "object" && rawBody && "error" in rawBody
        ? String((rawBody as { error: string }).error)
        : String(response.status);
      throw new Error(error);
    }
    const rawBody = await response.json().catch(() => ({}));
    return rawBody as T;
  }, []);

  const refreshGallery = useCallback(async () => {
    setIsLoadingGallery(true);
    setGalleryError(null);
    try {
      const gallery = await requestApi<MakesQueryResult>(makeApiUrl("gallery"));
      setGalleryItems(gallery.page);
      galleryCursorRef.current = gallery.continueCursor || null;
      setGalleryDone(gallery.isDone);
      setTotalCount(gallery.resultsCount ?? 0);
    } catch (error) {
      setGalleryError(labels.loadError);
      setGalleryDone(true);
    } finally {
      setIsLoadingGallery(false);
    }
  }, [labels.loadError, makeApiUrl, requestApi]);

  const loadMore = useCallback(async () => {
    const galleryCursor = galleryCursorRef.current;
    if (!galleryCursor || galleryDone || isLoadingGallery) return;
    setIsLoadingGallery(true);
    setGalleryError(null);
    try {
      const gallery = await requestApi<MakesQueryResult>(makeApiUrl("gallery", galleryCursor));
      setGalleryItems((current) => [...current, ...gallery.page]);
      galleryCursorRef.current = gallery.continueCursor || null;
      setGalleryDone(gallery.isDone);
      setTotalCount(gallery.resultsCount ?? galleryItems.length + gallery.page.length);
    } catch {
      setGalleryError(labels.loadMoreError);
    } finally {
      setIsLoadingGallery(false);
    }
  }, [galleryDone, galleryItems.length, isLoadingGallery, labels.loadMoreError, makeApiUrl, requestApi]);

  const loadInitial = useCallback(async () => {
    try {
      const [preview, gallery] = await Promise.all([
        requestApi<MakesPreviewResult>(makeApiUrl("preview")),
        requestApi<MakesQueryResult>(makeApiUrl("gallery")),
      ]);
      setPreviewItems(preview.page);
      setTotalCount(preview.resultsCount ?? gallery.resultsCount ?? 0);
      setGalleryItems(gallery.page);
      galleryCursorRef.current = gallery.continueCursor || null;
      setGalleryDone(gallery.isDone);
    } catch {
      setGalleryError(labels.loadError);
      setTotalCount(0);
    }
  }, [labels.loadError, makeApiUrl, requestApi]);

  useEffect(() => {
    queueMicrotask(() => void loadInitial());
  }, [loadInitial]);

  useEffect(() => {
    if (!searchParams) return;
    const shouldOpen = searchParams.get("make") === "1";
    if (shouldOpen) {
      queueMicrotask(() => {
        setComposerOpen(true);
        const next = new URLSearchParams(searchParams.toString());
        next.delete("make");
        window.history.replaceState({}, "", `${pathname}${next.toString() ? `?${next}` : ""}`);
      });
    }
  }, [pathname, searchParams]);

  const upsertGalleryItem = useCallback((item: MakeItem | null) => {
    if (!item) return;
    setGalleryItems((current) => {
      const exists = current.find((entry) => entry._id === item._id);
      if (!exists) {
        return [item, ...current];
      }
      return current.map((entry) => (entry._id === item._id ? item : entry));
    });
    setPreviewItems((current) => {
      const next = [item, ...current.filter((entry) => entry._id !== item._id)];
      return next.slice(0, 4);
    });
  }, []);

  const removeGalleryItem = useCallback((makeId: string) => {
    setGalleryItems((current) => current.filter((item) => item._id !== makeId));
    setPreviewItems((current) => current.filter((item) => item._id !== makeId));
    setTotalCount((current) => Math.max(0, current - 1));
  }, []);

  const editExisting = useCallback((make: MakeItem) => {
    setEditingMakeId(make._id);
    setAuthorName(make.authorName ?? "");
    setCaption(make.caption ?? "");
    setAltText(make.altText ?? "");
    setHasPhoto(Boolean(make.thumbnailUrl));
    setComposerOpen(true);
    setSubmitError(null);
    setFormError(null);
    window.requestAnimationFrame(() => {
      fileInputRef.current?.focus();
    });
  }, []);

  const replaceExisting = useCallback((make: MakeItem) => {
    setEditingMakeId(make._id);
    setAuthorName(make.authorName ?? "");
    setCaption(make.caption ?? "");
    setAltText(make.altText ?? "");
    setHasPhoto(Boolean(make.thumbnailUrl));
    setComposerOpen(true);
    setSubmitError(null);
    setFormError(null);
  }, []);

  const updatePhotoSelection = useCallback((file: File | null) => {
    setFormError(null);
    if (!file) {
      removePhotoPreview();
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      setFormError(labels.photoInvalid);
      removePhotoPreview();
      setHasPhoto(false);
      return;
    }

    selectedPhotoRef.current = file;
    setPhotoPreview(URL.createObjectURL(file));
    setHasPhoto(true);
  }, [labels.photoInvalid, removePhotoPreview]);

  useEffect(() => () => {
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
  }, [photoPreview]);

  const requestTicket = useCallback(async (makeIdToReplace?: string): Promise<string> => {
    const action: MakeMutation = makeIdToReplace
      ? { action: "requestTicket", slug: recipe.slug, makeIdToReplace }
      : { action: "requestTicket", slug: recipe.slug };
    const result = await requestApi<{ ticketDigest?: string; error?: string }>(
      "/api/recipes/makes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      },
    );
    if (!result.ticketDigest) {
      throw new Error(result.error ?? "RECIPE_MAKE_TICKET_INVALID");
    }
    return result.ticketDigest;
  }, [recipe.slug, requestApi]);

  const refreshSingleMake = useCallback(async (makeId: string) => {
    const gallery = await requestApi<MakesQueryResult>(makeApiUrl("gallery"));
    const updated = gallery.page.find((item) => item._id === makeId);
    if (updated) {
      upsertGalleryItem(updated);
      return;
    }
    const preview = await requestApi<MakesPreviewResult>(makeApiUrl("preview"));
    const previewUpdated = preview.page.find((item) => item._id === makeId);
    if (previewUpdated) upsertGalleryItem(previewUpdated);
  }, [makeApiUrl, requestApi, upsertGalleryItem]);

  const publishOrSave = useCallback(async () => {
    if (isSubmitting) return;
    setSubmitError(null);

    const normalizedAuthor = authorName.trim().slice(0, 120);
    const normalizedCaption = caption.trim().slice(0, 500);
    const normalizedAlt = altText.trim().slice(0, 500);
    const isEditing = Boolean(editingMakeId);
    const selectedPhoto = selectedPhotoRef.current;

    if (isEditing && !selectedPhoto && !normalizedAuthor && !normalizedCaption && !normalizedAlt) {
      return setSubmitError(labels.noChangesError);
    }
    if (!isEditing && !selectedPhoto) {
      return setSubmitError(labels.photoRequired);
    }

    try {
      setQueryState("submitting");
      if (selectedPhoto) {
        const ticketDigest = await requestTicket(editingMakeId ?? undefined);
        setQueryState("uploading");
        await uploadRecipeMakePhoto({
          file: selectedPhoto,
          slug: recipe.slug,
          ticketDigest,
          ...(normalizedAuthor ? { authorName: normalizedAuthor } : {}),
          ...(normalizedCaption ? { caption: normalizedCaption } : {}),
          ...(normalizedAlt ? { altText: normalizedAlt } : {}),
        });
        setQueryState("idle");
        if (editingMakeId) {
          setEditingMakeId(null);
          await refreshGallery();
        } else {
          await loadInitial();
        }
      } else if (isEditing && editingMakeId) {
        await requestApi<{ makeId: string }>("/api/recipes/makes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            makeId: editingMakeId,
            ...(normalizedAuthor ? { authorName: normalizedAuthor } : {}),
            ...(normalizedCaption ? { caption: normalizedCaption } : {}),
            ...(normalizedAlt ? { altText: normalizedAlt } : {}),
          } satisfies MakeMutation),
        });
        const item = galleryItems.find((entry) => entry._id === editingMakeId);
        if (item) {
          upsertGalleryItem({
            ...item,
            authorName: normalizedAuthor || null,
            caption: normalizedCaption || null,
            altText: normalizedAlt || null,
            edited: true,
          });
        }
      }
      toast.success(isEditing ? labels.updated : labels.success);
      closeComposer();
      await refreshGallery();
    } catch (error) {
      setSubmitError(mapApiError(String(error instanceof Error ? error.message : error)));
    } finally {
      setQueryState("idle");
    }
  }, [
    altText,
    authorName,
    caption,
    editingMakeId,
    galleryItems,
    closeComposer,
    isSubmitting,
    labels,
    mapApiError,
    loadInitial,
    refreshGallery,
    requestApi,
    requestTicket,
    upsertGalleryItem,
    recipe.slug,
  ]);

  const removeMake = useCallback(async (makeId: string) => {
    if (!window.confirm(labels.deleteConfirm)) return;
    try {
      await requestApi<{ makeId: string }>("/api/recipes/makes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", makeId }),
      });
      removeGalleryItem(makeId);
      toast.success(labels.deleted);
    } catch (error) {
      setSubmitError(mapApiError(String(error instanceof Error ? error.message : error)));
    }
  }, [labels.deleteConfirm, labels.deleted, mapApiError, requestApi, removeGalleryItem]);

  const toggleBravo = useCallback(async (makeId: string) => {
    try {
      const updated = await requestApi<{ makeId: string; bravoCount: number; hasBravo: boolean }>(
        "/api/recipes/makes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggleBravo", makeId } satisfies MakeMutation),
        },
      );
      setGalleryItems((current) =>
        current.map((make) =>
          make._id === makeId
            ? {
              ...make,
              bravoCount: updated.bravoCount,
              viewerHasBravo: updated.hasBravo,
            }
            : make,
        ),
      );
      setPreviewItems((current) =>
        current.map((make) =>
          make._id === makeId
            ? {
              ...make,
              bravoCount: updated.bravoCount,
              viewerHasBravo: updated.hasBravo,
            }
            : make,
        ),
      );
    } catch {
      toast.error(labels.reactionError);
    }
  }, [labels.reactionError, requestApi]);

  const submitReport = useCallback(async () => {
    if (!reportDialog) return;
    const details = reportDialog.details.trim().slice(0, 500);
    try {
      await requestApi<{ reportId: string | null }>("/api/recipes/makes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report",
          makeId: reportDialog.makeId,
          reason: reportDialog.reason,
          ...(details ? { details } : {}),
        }),
      });
      setReportDialog(null);
      toast.success(labels.reported);
      await refreshSingleMake(reportDialog.makeId);
    } catch (error) {
      toast.error(mapApiError(String(error instanceof Error ? error.message : error)));
    }
  }, [mapApiError, refreshSingleMake, reportDialog, requestApi, labels.reported]);

  function resolveAltText(make: MakeItem) {
    if (make.altText) return make.altText;
    if (make.caption) return make.caption;
    return labels.photoAltFallback
      .replace("{recipe}", recipe.title)
      .replace("{author}", make.authorName ?? labels.anonymous);
  }

  const previewItemsToRender = previewItems.slice(0, 4);

  const photoActionLabel = isSubmitting ? labels.uploading : labels.publish;
  const hasAnyItems = previewItems.length > 0 || galleryItems.length > 0;

  return (
    <section aria-label={labels.title} className="mx-auto mt-12 max-w-7xl px-5 pb-16 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-label mb-2 text-primary">{labels.eyebrow}</p>
          <h2 className="type-page-title">{labels.title}</h2>
          <p className="mt-2 type-body-sm text-muted-foreground">
            {countLabel}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setComposerOpen(true);
          }}
        >
          <Camera data-icon="inline-start" />
          {labels.compositionCallToAction}
        </Button>
      </div>

      <p className="type-body-spacious mb-8 text-muted-foreground">{labels.description}</p>

      <div className="mb-8">
        <h3 className="type-content-title mb-3">{labels.previewTitle}</h3>
        {previewItemsToRender.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {previewItemsToRender.map((make) => (
              <li key={make._id} className="group relative overflow-hidden rounded-xl">
                <button
                  type="button"
                  className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl border border-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => setLightboxMake(make)}
                  aria-label={resolveAltText(make)}
                >
                  {make.thumbnailUrl ? (
                    <Image
                      src={make.thumbnailUrl}
                      alt={resolveAltText(make)}
                      fill
                      sizes="(max-width: 768px) 48vw, 22vw"
                      className="image-outline object-cover"
                    />
                  ) : null}
                  <span className="absolute inset-0 bg-black/40 p-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
                    <span className="font-semibold">{make.caption ?? labels.untitled}</span>
                  </span>
                </button>
                <p className="mt-2 type-meta line-clamp-1 text-muted-foreground">
                  {make.authorName ?? labels.anonymous}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="image">
                <Camera />
              </EmptyMedia>
              <EmptyTitle>{labels.empty}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
        {!hasAnyItems ? (
          <p className="mt-3 type-body-sm text-muted-foreground">{labels.empty}</p>
        ) : null}
      </div>

      <div>
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h3 className="type-content-title">{labels.gallery}</h3>
          <p className="type-meta text-muted-foreground">
            {labels.resultCount.replace("{count}", String(totalCount))}
          </p>
        </div>
        {isLoadingGallery && galleryItems.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
          </div>
        ) : null}
        {galleryError ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{galleryError}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {galleryItems.map((make) => (
            <article key={make._id} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
              <button
                type="button"
                className="group relative mb-3 block aspect-[16/10] w-full overflow-hidden rounded-lg"
                onClick={() => setLightboxMake(make)}
                aria-label={labels.openPhoto}
              >
                {make.fullPhotoUrl ? (
                  <Image
                    src={make.fullPhotoUrl}
                    alt={resolveAltText(make)}
                    fill
                    sizes="(max-width: 768px) 92vw, (max-width: 1280px) 48vw, 32vw"
                    className="image-outline object-cover transition group-hover:scale-[1.02]"
                  />
                ) : null}
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                  <Maximize2 className="size-8 text-white" />
                </span>
              </button>
              <h4 className="type-subsection-title line-clamp-2">
                {make.caption || labels.untitled}
              </h4>
              <p className="mt-1 type-body-sm text-muted-foreground">
                {labels.byUser.replace("{author}", make.authorName || labels.anonymous)}
                {make.edited ? ` · ${labels.edited}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={make.viewerHasBravo ? "default" : "outline"}
                  onClick={() => void toggleBravo(make._id)}
                  aria-label={labels.bravo}
                >
                  <Check data-icon="inline-start" />
                  {labels.bravoLabel.replace("{count}", String(make.bravoCount))}
                </Button>
                {make.canEdit ? (
                  <>
                    <Button type="button" size="sm" variant="outline" onClick={() => editExisting(make)}>
                      <Edit3 data-icon="inline-start" />
                      {labels.edit}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => replaceExisting(make)}>
                      <Replace data-icon="inline-start" />
                      {labels.replace}
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => void removeMake(make._id)}>
                      <Trash2 data-icon="inline-start" />
                      {labels.delete}
                    </Button>
                  </>
                ) : null}
                {make.canReport ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={make.viewerHasReported}
                    onClick={() =>
                      setReportDialog({
                        makeId: make._id,
                        reason: "other",
                        details: "",
                      })
                    }
                    aria-label={labels.report}
                  >
                    <ShieldAlert data-icon="inline-start" />
                    {make.viewerHasReported ? labels.reportedShort : labels.report}
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 type-meta text-muted-foreground">
                <Calendar className="mr-1 inline size-3" />
                {labels.openedOn.replace("{date}", new Date(make._creationTime).toLocaleDateString(locale, { timeZone: "UTC" }))}
              </p>
            </article>
          ))}
        </div>
        {!isLoadingGallery && !galleryDone ? (
          <Button
            className="mt-5"
            type="button"
            variant="outline"
            onClick={() => void loadMore()}
          >
            {labels.loadMore}
          </Button>
        ) : null}
      </div>

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="">
            <DialogTitle className="">{editingMakeId ? labels.editTitle : labels.addTitle}</DialogTitle>
            <DialogDescription className="">{labels.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="type-label">{labels.authorLabel}</span>
              <Input
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder={labels.authorPlaceholder}
                maxLength={60}
              />
            </label>
            <label className="grid gap-2">
              <span className="type-label">{labels.captionLabel}</span>
              <Input
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder={labels.captionPlaceholder}
                maxLength={120}
              />
            </label>
            <label className="grid gap-2">
              <span className="type-label">{labels.altLabel}</span>
              <Input
                value={altText}
                onChange={(event) => setAltText(event.target.value)}
                placeholder={labels.altPlaceholder}
                maxLength={500}
              />
            </label>
            <label className="grid gap-2">
              <span className="type-label">{labels.photoLabel}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="block h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                onChange={(event) => updatePhotoSelection(event.target.files?.[0] ?? null)}
              />
              <p className="type-body-sm text-muted-foreground">{labels.photoHelp}</p>
            </label>
            {photoPreview ? (
              <div className="relative">
                <p className="type-meta mb-2">{labels.photoSelected}</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm text-destructive"
                  onClick={removePhotoPreview}
                >
                  <X className="size-4" />
                  {labels.removePhoto}
                </button>
                <span className="relative mt-2 block aspect-[16/10] w-40 overflow-hidden rounded-lg border border-border">
                  <Image
                    src={photoPreview}
                    alt={altText || "Photo de prévisualisation"}
                    fill
                    sizes="10rem"
                    className="object-cover"
                  />
                </span>
              </div>
            ) : hasPhoto && !editingMakeId ? (
              <p className="type-body-sm text-muted-foreground">{labels.photoPending}</p>
            ) : null}
            <p className="type-body-sm text-muted-foreground">
              <Link href={`/${locale}/conditions-de-participation`} className="underline">
                {labels.termsLabel}
              </Link>
            </p>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            {submitError ? <p role="alert" className="text-sm text-destructive">{submitError}</p> : null}
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeComposer}
                disabled={isSubmitting}
              >
                {labels.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => void publishOrSave()}
                disabled={isSubmitting}
              >
                {queryState === "uploading" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {queryState === "uploading" ? labels.uploading : photoActionLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(lightboxMake)} onOpenChange={() => setLightboxMake(null)}>
        <DialogContent className="max-w-5xl">
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
            <button
              type="button"
              className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-3 py-2 text-sm text-white"
              onClick={() => setLightboxMake(null)}
            >
              <X className="size-4" />
              <span className="sr-only">{labels.close}</span>
            </button>
            {lightboxMake?.fullPhotoUrl ? (
              <Image
                src={lightboxMake.fullPhotoUrl}
                alt={resolveAltText(lightboxMake)}
                fill
                sizes="100vw"
                className="rounded-xl object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reportDialog)} onOpenChange={(open: boolean) => !open && setReportDialog(null)}>
        <DialogContent className="">
          <DialogHeader className="">
            <DialogTitle className="">{labels.report}</DialogTitle>
            <DialogDescription className="">{labels.reportDescription}</DialogDescription>
          </DialogHeader>
          {reportDialog ? (
            <div className="grid gap-3">
              <label className="grid gap-2">
                <span className="type-label">{labels.reportReasonLabel}</span>
                <select
                  value={reportDialog.reason}
                  className="rounded-lg border bg-background px-3 py-2"
                  onChange={(event) => {
                    const value = event.target.value as ReportReason;
                    setReportDialog((current) => current ? { ...current, reason: value } : null);
                  }}
                >
                  <option value="spam">{labels.reportReasons.spam}</option>
                  <option value="inappropriate">{labels.reportReasons.inappropriate}</option>
                  <option value="privacy">{labels.reportReasons.privacy}</option>
                  <option value="copyright">{labels.reportReasons.copyright}</option>
                  <option value="other">{labels.reportReasons.other}</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="type-label">{labels.reportDetailsLabel}</span>
                <Textarea
                  value={reportDialog.details}
                  maxLength={500}
                  onChange={(event) => {
                    setReportDialog((current) =>
                      current ? { ...current, details: event.target.value } : null,
                    );
                  }}
                />
              </label>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReportDialog(null)}
                >
                  {labels.cancel}
                </Button>
                <Button type="button" onClick={() => void submitReport()}>
                  <MessageSquarePlus />
                  {labels.report}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
