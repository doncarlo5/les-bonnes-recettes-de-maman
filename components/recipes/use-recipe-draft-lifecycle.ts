"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  UseFormClearErrors,
  UseFormGetValues,
  UseFormReset,
  UseFormSetError,
} from "react-hook-form";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/i18n/config";
import {
  createBrowserRecipeEditingEnvironment,
  createFetchRecipeEditingTransport,
  RecipeEditingSession,
  type RecipeFormMode,
  type SaveRecipeState,
  type SyncState,
} from "./recipe-editing-session";
import { toFormValues } from "./recipe-draft-form-values";
import type {
  RecipeDraftFormInput,
  RecipeDraftPayload,
} from "./recipe-form-schema";
import {
  editableRecipeDraftSchema,
  partitionRecipeServerErrors,
} from "./recipe-form-schema";
import type { EditableRecipe } from "./types";
import type { RecipeImageMutation } from "./recipe-main-image-acquisition";

export type { RecipeFormMode, SaveRecipeState, SyncState };
export { cloneRecipe, toFormValues } from "./recipe-draft-form-values";

type LifecycleOptions = {
  locale: Locale;
  mode: RecipeFormMode;
  selectedSlug: string;
  selectedRecipe: EditableRecipe | null;
  initialRecipe: EditableRecipe | null;
  sourceIdeaId?: Id<"recipeIdeas">;
  watchedValues: unknown;
  getValues: UseFormGetValues<RecipeDraftFormInput>;
  reset: UseFormReset<RecipeDraftFormInput>;
  setError: UseFormSetError<RecipeDraftFormInput>;
  clearErrors: UseFormClearErrors<RecipeDraftFormInput>;
  validateDraft: () => Promise<RecipeDraftPayload | null>;
  onFieldError: (field: string) => void;
  onCreated: (slug: string) => void;
  onDeleted: () => void;
  onRestoredImage: (
    image: RecipeImageMutation & { slug: string },
  ) => void;
};

export function useRecipeDraftLifecycle({
  locale,
  mode,
  selectedSlug,
  selectedRecipe,
  initialRecipe,
  sourceIdeaId,
  watchedValues,
  getValues,
  reset,
  setError,
  clearErrors,
  validateDraft,
  onFieldError,
  onCreated,
  onDeleted,
  onRestoredImage,
}: LifecycleOptions) {
  const [session] = useState(
    () =>
      new RecipeEditingSession({
        transport: createFetchRecipeEditingTransport(),
        environment: createBrowserRecipeEditingEnvironment(),
        context: { locale, mode, selectedSlug, sourceIdeaId },
        initialDraft: initialRecipe
          ? toFormValues(initialRecipe)
          : (getValues() as RecipeDraftPayload),
        initialRevision: initialRecipe?.revision ?? 0,
        initialPublishedRevision: initialRecipe?.publishedRevision ?? -1,
        initialIsPublic: initialRecipe?.status === "published",
        loadedRecipeSlug: initialRecipe?.slug ?? "",
        selectedRecipe: selectedRecipe
          ? {
              slug: selectedRecipe.slug,
              revision: selectedRecipe.revision,
              publishedRevision: selectedRecipe.publishedRevision,
              isPublic: selectedRecipe.status === "published",
              draft: toFormValues(selectedRecipe),
            }
          : undefined,
      }),
  );
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  useEffect(() => session.connect(), [session]);

  useEffect(() => {
    session.updateContext({
      context: { locale, mode, selectedSlug, sourceIdeaId },
      selectedRecipe: selectedRecipe
        ? {
            slug: selectedRecipe.slug,
            revision: selectedRecipe.revision,
            publishedRevision: selectedRecipe.publishedRevision,
            isPublic: selectedRecipe.status === "published",
            draft: toFormValues(selectedRecipe),
          }
        : undefined,
    });
  }, [locale, mode, selectedRecipe, selectedSlug, session, sourceIdeaId]);

  useLayoutEffect(() => {
    if (!watchedValues) return;
    session.observeDraft(watchedValues as RecipeDraftPayload);
  }, [session, watchedValues]);

  useEffect(() => {
    if (!watchedValues || snapshot.syncState === "conflict") return;
    const parsed = editableRecipeDraftSchema.safeParse(watchedValues);
    if (!parsed.success) return;
    if (
      mode === "create" &&
      !parsed.data.translations.fr.title.trim()
    ) return;
    const timer = window.setTimeout(() => {
      void session.save(parsed.data);
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [mode, session, snapshot.syncState, watchedValues]);

  useEffect(() => {
    if (snapshot.recoveredDraft) reset(snapshot.recoveredDraft);
  }, [reset, snapshot.recoveredDraft]);

  useEffect(() => {
    if (snapshot.createdSlug) onCreated(snapshot.createdSlug);
  }, [onCreated, snapshot.createdSlug]);

  useEffect(() => {
    if (snapshot.deleted) onDeleted();
  }, [onDeleted, snapshot.deleted]);

  useEffect(() => {
    const result = snapshot.formResult;
    if (!result) return;
    if (result.type === "success") {
      clearErrors("root.server");
      return;
    }
    if (result.type === "validation") {
      clearErrors();
      const { fields, hasUnmappedPath } = partitionRecipeServerErrors(
        result.fieldErrors ?? {},
      );
      for (const [fieldPath, message] of fields) {
        setError(fieldPath, { type: "server", message });
      }
      if (result.formError || fields.length === 0 || hasUnmappedPath) {
        setError("root.server", {
          type: "server",
          message: result.formError ?? result.message,
        });
      }
      const firstField = fields[0]?.[0];
      if (firstField) onFieldError(firstField);
      return;
    }
    if (result.type === "error") {
      setError("root.server", { type: "server", message: result.message });
    }
  }, [clearErrors, onFieldError, setError, snapshot.formResult]);

  const saveCurrentDraft = useCallback(
    async (force = false) => {
      const payload = await validateDraft();
      if (!payload) {
        session.recordValidationFailure(getValues() as RecipeDraftPayload);
        return false;
      }
      return session.save(payload, force);
    },
    [getValues, session, validateDraft],
  );

  const replaceConflict = useCallback(async () => {
    const payload = await validateDraft();
    if (!payload) {
      session.recordValidationFailure(getValues() as RecipeDraftPayload);
      return false;
    }
    return session.replaceConflict(payload);
  }, [getValues, session, validateDraft]);

  const publishCurrentDraft = useCallback(async () => {
    const payload = await validateDraft();
    if (!payload) {
      session.recordValidationFailure(getValues() as RecipeDraftPayload);
      return false;
    }
    return session.publish(payload, snapshot.syncState === "conflict");
  }, [getValues, session, snapshot.syncState, validateDraft]);

  const revertToPublished = useCallback(async () => {
    const reverted = await session.discard();
    const restoredImage = session.getSnapshot().restoredImage;
    if (reverted && restoredImage) onRestoredImage(restoredImage);
    return reverted;
  }, [onRestoredImage, session]);

  return {
    state: snapshot.state,
    isPending: snapshot.isPending,
    syncState: snapshot.syncState,
    hasUnsavedChanges: snapshot.hasUnsavedChanges,
    revision: snapshot.revision,
    publishedRevision: snapshot.publishedRevision,
    isPublic: snapshot.isPublic,
    saveCurrentDraft,
    publishCurrentDraft,
    revertToPublished,
    setVisibility: session.setVisibility,
    imageRevisionSession: session.imageRevisionSession,
    deleteRecipe: session.deleteRecipe,
    replaceConflict,
    reloadLatest: session.reloadLatest,
    resetSyncState: session.resetSyncState,
  };
}
