"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { UseFormGetValues, UseFormReset, UseFormSetValue } from "react-hook-form";
import type { Locale } from "@/i18n/config";
import type { RecipeFormPayload } from "./recipe-form-schema";
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
  draft?: RecipeFormPayload;
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
  watchedValues: Partial<RecipeFormPayload> | undefined;
  getValues: UseFormGetValues<any>;
  reset: UseFormReset<any>;
  setValue: UseFormSetValue<any>;
  onCreated: (slug: string) => void;
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
  setValue,
  onCreated,
  onRefresh,
}: LifecycleOptions) {
  const [state, setState] = useState<SaveRecipeState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [revision, setRevision] = useState(initialRecipe?.revision ?? 0);
  const [publishedRevision, setPublishedRevision] = useState(initialRecipe?.publishedRevision ?? -1);
  const revisionRef = useRef(initialRecipe?.revision ?? 0);
  const saveInFlightRef = useRef(false);
  const queuedPayloadRef = useRef<RecipeFormPayload | null>(null);
  const queuedForceRef = useRef(false);
  const queuedSaveWaitersRef = useRef<Array<(saved: boolean) => void>>([]);
  const saveIdleWaitersRef = useRef<Array<() => void>>([]);
  const autosaveTimerRef = useRef<number | null>(null);
  const destructiveOperationRef = useRef(false);
  const conflictRetryRef = useRef<((revision: number) => Promise<void>) | null>(null);
  const savePayloadRef = useRef<((payload: RecipeFormPayload, force?: boolean) => Promise<boolean>) | null>(null);
  const lastSavedPayloadRef = useRef(
    draftFingerprint(initialRecipe ? toFormValues(initialRecipe) : getValues()),
  );

  const savePayload = useCallback(async (payload: RecipeFormPayload, force = false) => {
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
        setSyncState("error");
        return false;
      }

      const nextRevision = data.revision ?? revisionRef.current;
      revisionRef.current = nextRevision;
      setRevision(nextRevision);
      lastSavedPayloadRef.current = fingerprint;
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
  }, [locale, mode, onCreated, selectedSlug]);

  useEffect(() => { savePayloadRef.current = savePayload; }, [savePayload]);

  useEffect(() => {
    if (mode !== "update" || !selectedSlug || !watchedValues) return;
    autosaveTimerRef.current = window.setTimeout(() => {
      if (!destructiveOperationRef.current) void savePayload(watchedValues as RecipeFormPayload);
    }, 800);
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    };
  }, [mode, savePayload, selectedSlug, watchedValues]);

  useEffect(() => {
    if (!selectedSlug) return;
    const recovered = localStorage.getItem(recoveryKey(selectedSlug));
    if (!recovered) return;
    try {
      const parsed = JSON.parse(recovered) as { payload?: RecipeFormPayload; revision?: number };
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
    if (syncState === "offline") void savePayload(getValues());
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
      persistRecovery(selectedSlug, normalizePayload(values), revisionRef.current);
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
    if (selectedRecipe.revision !== revisionRef.current || selectedRecipe.status !== getValues("status")) {
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

  async function flushLatestDraft() {
    if (mode !== "update" || !selectedSlug) return true;
    while (true) {
      const saved = await savePayload(getValues());
      if (!saved) return false;
      if (draftFingerprint(getValues()) === lastSavedPayloadRef.current && !saveInFlightRef.current && !queuedPayloadRef.current) return true;
    }
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
      setValue("status", "published");
      setPublishedRevision(data.publishedRevision ?? revisionRef.current);
      setSyncState("saved");
      onRefresh();
    } finally {
      setIsPending(false);
    }
  }

  async function discardChanges() {
    if (!selectedSlug || !window.confirm("Abandonner toutes les modifications non publiees ?")) return;
    destructiveOperationRef.current = true;
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = null;
    queuedPayloadRef.current = null;
    for (const resolve of queuedSaveWaitersRef.current) resolve(false);
    queuedSaveWaitersRef.current = [];
    await waitForSaveIdle();
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
        setValue("status", "draft");
        onRefresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  function resetForCreate(payload: RecipeFormPayload) {
    revisionRef.current = 0;
    setRevision(0);
    setPublishedRevision(-1);
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
    const saved = await savePayload(getValues(), true);
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
    savePayload,
    flushLatestDraft,
    publishRecipe,
    discardChanges,
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

function persistRecovery(slug: string, payload: RecipeFormPayload, revision: number) {
  localStorage.setItem(recoveryKey(slug), JSON.stringify({ payload, revision }));
}

export function toFormValues(recipe: EditableRecipe): RecipeFormPayload {
  return cloneRecipe({
    defaultLocale: recipe.defaultLocale,
    translations: recipe.translations,
    tags: recipe.tags,
    status: recipe.status,
  });
}

export function normalizePayload(value: RecipeFormPayload): RecipeFormPayload {
  return {
    ...value,
    tags: (value.tags ?? []).flatMap((tag) => tag.trim() ? [tag.trim()] : []),
    translations: {
      fr: normalizeLocalizedRecipe(value.translations.fr),
      en: normalizeLocalizedRecipe(value.translations.en),
    },
  };
}

function draftFingerprint(value: RecipeFormPayload) {
  const normalized = normalizePayload(value);
  return JSON.stringify({
    defaultLocale: normalized.defaultLocale,
    translations: normalized.translations,
    tags: normalized.tags,
  });
}

function normalizeLocalizedRecipe(recipe: RecipeFormPayload["translations"][LocaleKey]) {
  const servingsQuantity = Number(recipe.servings?.quantity);
  const servingsUnit = recipe.servings?.unit?.trim() ?? "";
  return {
    ...recipe,
    servings: Number.isFinite(servingsQuantity) && servingsQuantity > 0 && servingsUnit
      ? { quantity: servingsQuantity, unit: servingsUnit }
      : null,
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

export function cloneRecipe(recipe: RecipeFormPayload): RecipeFormPayload {
  return structuredClone(recipe);
}
