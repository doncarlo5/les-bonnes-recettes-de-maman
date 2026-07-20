"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type {
  FieldPath,
  UseFormClearErrors,
  UseFormGetValues,
  UseFormReset,
  UseFormSetError,
} from "react-hook-form";
import type { Locale } from "@/i18n/config";
import type {
  RecipeDraftFormInput,
  RecipeDraftPayload,
} from "./recipe-form-schema";
import type { EditableRecipe } from "./types";

export type SaveRecipeState = {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
  slug?: string;
  revision?: number;
  publishedRevision?: number;
  savedAt?: number;
  latestRevision?: number;
  fieldErrors?: Record<string, string>;
  draft?: RecipeDraftPayload;
};

export type SyncState = "idle" | "saving" | "saved" | "offline" | "error" | "conflict";
export type RecipeFormMode = "create" | "update";
type LocaleKey = "fr" | "en";

const initialState: SaveRecipeState = {
  type: "idle",
  message: "Choisis une recette ou cree un brouillon.",
};

type LifecycleOptions = {
  locale: Locale;
  mode: RecipeFormMode;
  selectedSlug: string;
  selectedRecipe: EditableRecipe | null;
  initialRecipe: EditableRecipe | null;
  watchedValues: unknown;
  getValues: UseFormGetValues<RecipeDraftFormInput>;
  reset: UseFormReset<RecipeDraftFormInput>;
  setError: UseFormSetError<RecipeDraftFormInput>;
  clearErrors: UseFormClearErrors<RecipeDraftFormInput>;
  validateDraft: () => Promise<RecipeDraftPayload | null>;
  onFieldError: (field: string) => void;
  onCreated: (slug: string) => void;
  onDeleted: () => void;
  onRefresh: () => void;
};

export function useRecipeDraftLifecycle({
  locale,
  mode,
  selectedSlug,
  selectedRecipe,
  initialRecipe,
  watchedValues,
  getValues,
  reset,
  setError,
  clearErrors,
  validateDraft,
  onFieldError,
  onCreated,
  onDeleted,
  onRefresh,
}: LifecycleOptions) {
  const [state, setState] = useState<SaveRecipeState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [revision, setRevision] = useState(initialRecipe?.revision ?? 0);
  const [publishedRevision, setPublishedRevision] = useState(initialRecipe?.publishedRevision ?? -1);
  const [publicationStatus, setPublicationStatus] = useState<"draft" | "published">(
    initialRecipe?.status ?? "draft",
  );
  const revisionRef = useRef(initialRecipe?.revision ?? 0);
  const saveInFlightRef = useRef(false);
  const queuedPayloadRef = useRef<RecipeDraftPayload | null>(null);
  const queuedForceRef = useRef(false);
  const queuedSaveWaitersRef = useRef<Array<(saved: boolean) => void>>([]);
  const saveIdleWaitersRef = useRef<Array<() => void>>([]);
  const autosaveTimerRef = useRef<number | null>(null);
  const destructiveOperationRef = useRef(false);
  const conflictRetryRef = useRef<((revision: number) => Promise<void>) | null>(null);
  const savePayloadRef = useRef<((payload: RecipeDraftPayload, force?: boolean) => Promise<boolean>) | null>(null);
  const lastSavedPayloadRef = useRef<string | null>(null);
  if (lastSavedPayloadRef.current === null) {
    lastSavedPayloadRef.current = draftFingerprint(
      initialRecipe ? toFormValues(initialRecipe) : getValues(),
    );
  }

  const savePayload = useCallback(async (payload: RecipeDraftPayload, force = false) => {
    if (saveInFlightRef.current) {
      queuedPayloadRef.current = payload;
      queuedForceRef.current ||= force;
      return new Promise<boolean>((resolve) => queuedSaveWaitersRef.current.push(resolve));
    }

    const normalized = normalizePayload(payload);
    const recipePayload = JSON.stringify(normalized);
    const fingerprint = draftFingerprint(normalized);
    if (!force && fingerprint === lastSavedPayloadRef.current) return true;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (selectedSlug) persistRecovery(selectedSlug, normalized, revisionRef.current);
      setSyncState("offline");
      return false;
    }

    saveInFlightRef.current = true;
    setIsPending(true);
    setSyncState("saving");
    let saved = false;
    try {
      const response = await fetch("/api/admin/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          mode,
          slug: selectedSlug,
          recipePayload,
          expectedRevision: revisionRef.current,
          force,
        }),
      });
      const data = (await response.json()) as SaveRecipeState;
      setState(data);
      if (response.status === 409 || data.type === "conflict") {
        conflictRetryRef.current = null;
        setSyncState("conflict");
        return false;
      }
      if (!response.ok || data.type !== "success" || !data.slug) {
        if (data.fieldErrors) {
          clearErrors();
          const entries = Object.entries(data.fieldErrors);
          for (const [path, message] of entries) {
            setError(path as FieldPath<RecipeDraftFormInput>, {
              type: "server",
              message,
            });
          }
          if (entries[0]) onFieldError(entries[0][0]);
        } else {
          setError("root.server", { type: "server", message: data.message });
        }
        setSyncState("error");
        return false;
      }

      const nextRevision = data.revision ?? revisionRef.current;
      revisionRef.current = nextRevision;
      setRevision(nextRevision);
      lastSavedPayloadRef.current = fingerprint;
      clearErrors("root.server");
      localStorage.removeItem(recoveryKey(data.slug));
      setSyncState("saved");
      if (mode === "create") onCreated(data.slug);
      saved = true;
    } catch {
      if (selectedSlug) persistRecovery(selectedSlug, normalized, revisionRef.current);
      setSyncState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
      setState({ type: "error", message: "Impossible d'enregistrer cette recette." });
    } finally {
      saveInFlightRef.current = false;
      setIsPending(false);
      const queued = queuedPayloadRef.current;
      const queuedForce = queuedForceRef.current;
      const waiters = queuedSaveWaitersRef.current;
      queuedPayloadRef.current = null;
      queuedForceRef.current = false;
      queuedSaveWaitersRef.current = [];
      if (queued && savePayloadRef.current) {
        const queuedSaved = await savePayloadRef.current(queued, queuedForce);
        saved = saved && queuedSaved;
        for (const resolve of waiters) resolve(queuedSaved);
      } else {
        for (const resolve of waiters) resolve(saved);
      }
      if (!saveInFlightRef.current && !queuedPayloadRef.current) {
        const idleWaiters = saveIdleWaitersRef.current;
        saveIdleWaitersRef.current = [];
        for (const resolve of idleWaiters) resolve();
      }
    }
    return saved;
  }, [clearErrors, locale, mode, onCreated, onFieldError, selectedSlug, setError]);

  useEffect(() => { savePayloadRef.current = savePayload; }, [savePayload]);

  const autosaveLatestDraft = useEffectEvent(() => {
    if (!destructiveOperationRef.current) void saveCurrentDraft();
  });
  useEffect(() => {
    if (mode !== "update" || !selectedSlug || !watchedValues) return;
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveLatestDraft();
    }, 800);
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    };
  }, [mode, selectedSlug, watchedValues]);

  useEffect(() => {
    if (!selectedSlug) return;
    const recovered = localStorage.getItem(recoveryKey(selectedSlug));
    if (!recovered) return;
    try {
      const parsed = JSON.parse(recovered) as { payload?: RecipeDraftFormInput; revision?: number };
      if (parsed.payload) {
        reset(parsed.payload);
        queueMicrotask(() => {
          if (parsed.revision === revisionRef.current) {
            setSyncState("offline");
          } else {
            setState({ type: "conflict", message: "Une récupération locale repose sur une révision plus ancienne.", latestRevision: revisionRef.current });
            setSyncState("conflict");
          }
        });
      }
    } catch {
      localStorage.removeItem(recoveryKey(selectedSlug));
    }
  }, [reset, selectedSlug]);

  const retryOnlineSave = useEffectEvent(() => {
    if (syncState === "offline") void saveCurrentDraft();
  });
  useEffect(() => {
    const retry = () => retryOnlineSave();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  const persistPendingNavigation = useEffectEvent(() => {
    if (!selectedSlug) return;
    const values = getValues();
    if (draftFingerprint(values) !== lastSavedPayloadRef.current) {
      persistRecovery(selectedSlug, values, revisionRef.current);
    }
  });
  useEffect(() => {
    const persist = () => persistPendingNavigation();
    window.addEventListener("pagehide", persist);
    window.addEventListener("popstate", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("popstate", persist);
    };
  }, []);

  useEffect(() => {
    if (!selectedRecipe || selectedRecipe.slug !== selectedSlug) return;
    queueMicrotask(() => setPublishedRevision(selectedRecipe.publishedRevision));
    queueMicrotask(() => setPublicationStatus(selectedRecipe.status));
    if (selectedRecipe.revision !== revisionRef.current) {
      const values = toFormValues(selectedRecipe);
      reset(values);
      revisionRef.current = selectedRecipe.revision;
      setRevision(selectedRecipe.revision);
      lastSavedPayloadRef.current = draftFingerprint(values);
    }
  }, [getValues, reset, selectedRecipe, selectedSlug]);

  function waitForSaveIdle() {
    if (!saveInFlightRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => saveIdleWaitersRef.current.push(resolve));
  }

  async function beginDestructiveOperation() {
    destructiveOperationRef.current = true;
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = null;
    queuedPayloadRef.current = null;
    for (const resolve of queuedSaveWaitersRef.current) resolve(false);
    queuedSaveWaitersRef.current = [];
    await waitForSaveIdle();
  }

  async function saveCurrentDraft(force = false) {
    const payload = await validateDraft();
    if (!payload) {
      if (selectedSlug) persistRecovery(selectedSlug, getValues(), revisionRef.current);
      setSyncState("error");
      return false;
    }
    return savePayload(payload, force);
  }

  async function flushLatestDraft() {
    if (mode !== "update" || !selectedSlug) return true;
    while (true) {
      const saved = await saveCurrentDraft();
      if (!saved) return false;
      const latest = await validateDraft();
      if (latest && draftFingerprint(latest) === lastSavedPayloadRef.current && !saveInFlightRef.current && !queuedPayloadRef.current) return true;
    }
  }

  async function prepareRevisionedMutation() {
    return (await flushLatestDraft()) ? revisionRef.current : null;
  }

  async function publishRecipe() {
    if (!selectedSlug || isPending || !(await flushLatestDraft())) return;
    setIsPending(true);
    try {
      const response = await fetch("/api/admin/recipes/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, expectedRevision: revisionRef.current }),
      });
      const data = (await response.json()) as SaveRecipeState;
      setState(data);
      if (!response.ok) {
        setSyncState(response.status === 409 ? "conflict" : "error");
        return;
      }
      setPublishedRevision(data.publishedRevision ?? revisionRef.current);
      setPublicationStatus("published");
      setSyncState("saved");
      onRefresh();
    } finally {
      setIsPending(false);
    }
  }

  async function discardChanges() {
    if (!selectedSlug || !window.confirm("Abandonner toutes les modifications non publiees ?")) return;
    await beginDestructiveOperation();
    setIsPending(true);
    try {
      const response = await fetch("/api/admin/recipes/discard-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, expectedRevision: revisionRef.current }),
      });
      const data = (await response.json()) as SaveRecipeState;
      setState(data);
      if (response.ok && typeof data.revision === "number" && data.draft) {
        const restored = cloneRecipe(data.draft);
        reset(restored);
        revisionRef.current = data.revision;
        setRevision(data.revision);
        setPublishedRevision(data.publishedRevision ?? data.revision);
        lastSavedPayloadRef.current = draftFingerprint(restored);
        localStorage.removeItem(recoveryKey(selectedSlug));
        setSyncState("saved");
        onRefresh();
      } else {
        setSyncState(response.status === 409 ? "conflict" : "error");
      }
    } finally {
      destructiveOperationRef.current = false;
      setIsPending(false);
    }
  }

  async function deleteRecipe() {
    if (!selectedSlug || isPending) return;
    await beginDestructiveOperation();
    setIsPending(true);
    try {
      const response = await fetch("/api/admin/recipes/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedSlug,
          expectedRevision: revisionRef.current,
        }),
      });
      const data = (await response.json()) as SaveRecipeState;
      setState(data);
      if (!response.ok) {
        setSyncState(response.status === 409 ? "conflict" : "error");
        return;
      }
      localStorage.removeItem(recoveryKey(selectedSlug));
      setSyncState("idle");
      onDeleted();
    } catch {
      setState({
        type: "error",
        message: "Impossible de supprimer cette recette.",
      });
      setSyncState("error");
    } finally {
      destructiveOperationRef.current = false;
      setIsPending(false);
    }
  }

  async function unpublishRecipe() {
    if (!selectedSlug || !window.confirm("Retirer cette recette du site public ?")) return;
    setIsPending(true);
    try {
      const response = await fetch("/api/admin/recipes/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug }),
      });
      if (response.ok) {
        setPublicationStatus("draft");
        onRefresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  function resetForCreate(payload: RecipeDraftPayload) {
    revisionRef.current = 0;
    setRevision(0);
    setPublishedRevision(-1);
    setPublicationStatus("draft");
    setSyncState("idle");
    lastSavedPayloadRef.current = draftFingerprint(payload);
  }

  function handleImageRevision(nextRevision: number) {
    revisionRef.current = nextRevision;
    setRevision(nextRevision);
    setSyncState("saved");
    onRefresh();
  }

  function handleImageConflict(latestRevision?: number, retry?: (revision: number) => Promise<void>) {
    conflictRetryRef.current = retry ?? null;
    setState({
      type: "conflict",
      message: "Ce brouillon a été modifié ailleurs.",
      latestRevision,
    });
    setSyncState("conflict");
  }

  async function replaceConflict() {
    const saved = await saveCurrentDraft(true);
    if (!saved || !conflictRetryRef.current) return;
    const retry = conflictRetryRef.current;
    conflictRetryRef.current = null;
    await retry(revisionRef.current);
  }

  function reloadLatest() {
    if (selectedSlug) localStorage.removeItem(recoveryKey(selectedSlug));
    window.location.reload();
  }

  return {
    state,
    isPending,
    syncState,
    revision,
    publishedRevision,
    publicationStatus,
    savePayload,
    saveCurrentDraft,
    flushLatestDraft,
    prepareRevisionedMutation,
    publishRecipe,
    discardChanges,
    deleteRecipe,
    unpublishRecipe,
    handleImageRevision,
    handleImageConflict,
    replaceConflict,
    reloadLatest,
    resetForCreate,
    resetSyncState: () => setSyncState("idle"),
  };
}

function recoveryKey(slug: string) {
  return `recipe-admin-draft:v1:${slug}`;
}

function persistRecovery(slug: string, payload: RecipeDraftFormInput, revision: number) {
  localStorage.setItem(recoveryKey(slug), JSON.stringify({ payload, revision }));
}

export function toFormValues(recipe: EditableRecipe): RecipeDraftPayload {
  return cloneRecipe({
    defaultLocale: recipe.defaultLocale,
    referenceServings: recipe.referenceServings,
    translations: recipe.translations,
    tags: recipe.tags,
  });
}

export function normalizePayload(value: RecipeDraftPayload): RecipeDraftPayload {
  return {
    ...value,
    tags: (value.tags ?? []).flatMap((tag) => tag.trim() ? [tag.trim()] : []),
    translations: {
      fr: normalizeLocalizedRecipe(value.translations.fr),
      en: normalizeLocalizedRecipe(value.translations.en),
    },
  };
}

function draftFingerprint(value: RecipeDraftPayload) {
  const normalized = normalizePayload(value);
  return JSON.stringify({
    defaultLocale: normalized.defaultLocale,
    referenceServings: normalized.referenceServings,
    translations: normalized.translations,
    tags: normalized.tags,
  });
}

function normalizeLocalizedRecipe(recipe: RecipeDraftPayload["translations"][LocaleKey]) {
  return {
    ...recipe,
    yieldLabel: recipe.yieldLabel.trim(),
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name.trim(),
      quantity: ingredient.quantity.trim(),
      unit: ingredient.unit.trim(),
      notes: ingredient.notes.trim(),
    })),
    sections: recipe.sections.map((section) => ({
      title: section.title.trim(),
      steps: section.steps.flatMap((step) => step.trim() ? [step.trim()] : []),
    })),
    subRecipes: recipe.subRecipes.map((subRecipe) => ({
      title: subRecipe.title.trim(),
      ingredients: subRecipe.ingredients.map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity: ingredient.quantity.trim(),
        unit: ingredient.unit.trim(),
        notes: ingredient.notes.trim(),
      })),
    })),
    notes: recipe.notes.flatMap((note) => note.trim() ? [note.trim()] : []),
  };
}

export function cloneRecipe(recipe: RecipeDraftPayload): RecipeDraftPayload {
  return structuredClone(recipe);
}
