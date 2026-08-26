import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/i18n/config";
import { compatibleRecipeDraftSchema } from "./recipe-form-schema";
import type { RecipeDraftPayload } from "./recipe-form-schema";
import type { Recipe } from "./types";
import {
  createRecipeImageRevisionSession,
  type RecipeImageRevisionSession,
} from "./recipe-main-image-acquisition";

export type SaveRecipeState = {
  type: "idle" | "success" | "validation" | "error" | "conflict";
  message: string;
  slug?: string;
  revision?: number;
  publishedRevision?: number;
  isPublic?: boolean;
  savedAt?: number;
  latestRevision?: number;
  fieldErrors?: Record<string, string>;
  formError?: string;
  draft?: RecipeDraftPayload;
  heroImageUrl?: string;
  imageCredit?: Recipe["imageCredit"];
};

export type SyncState =
  | "idle"
  | "saving"
  | "saved"
  | "offline"
  | "error"
  | "conflict";

export type RecipeFormMode = "create" | "update";

export type RecipeEditingSnapshot = {
  state: SaveRecipeState;
  formResult?: SaveRecipeState;
  isPending: boolean;
  syncState: SyncState;
  revision: number;
  publishedRevision: number;
  isPublic: boolean;
  hasUnsavedChanges: boolean;
  recoveredDraft?: RecipeDraftPayload;
  restoredImage?: {
    slug: string;
    revision: number;
    heroImageUrl: string;
    imageCredit?: Recipe["imageCredit"];
  };
  createdSlug?: string;
  deleted: boolean;
};

export type RecipeEditingTransport = {
  save(input: {
    locale: Locale;
    mode: RecipeFormMode;
    slug: string;
    recipePayload: string;
    expectedRevision: number;
    sourceIdeaId?: Id<"recipeIdeas">;
    force: boolean;
    keepalive?: boolean;
  }): Promise<{ ok: boolean; status: number; data: SaveRecipeState }>;
  deleteRecipe(input: {
    slug: string;
    expectedRevision: number;
  }): Promise<{ ok: boolean; status: number; data: SaveRecipeState }>;
  publish(input: { slug: string; expectedRevision: number }): Promise<{
    ok: boolean;
    status: number;
    data: SaveRecipeState;
  }>;
  discard(input: { slug: string; expectedRevision: number }): Promise<{
    ok: boolean;
    status: number;
    data: SaveRecipeState;
  }>;
  setVisibility(input: { slug: string; visible: boolean }): Promise<{
    ok: boolean;
    status: number;
    data: SaveRecipeState;
  }>;
};

export type RecipeEditingEnvironment = {
  isOnline(): boolean;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  subscribeOnline(listener: () => void): () => void;
  subscribeLeaving(listener: () => void): () => void;
  reload(): void;
};

type RecipeEditingContext = {
  locale: Locale;
  mode: RecipeFormMode;
  selectedSlug: string;
  sourceIdeaId?: Id<"recipeIdeas">;
};

type SelectedRecipeSnapshot = {
  slug: string;
  revision: number;
  publishedRevision: number;
  isPublic: boolean;
  draft: RecipeDraftPayload;
};

type QueuedSave = {
  payload: RecipeDraftPayload;
  force: boolean;
  keepalive: boolean;
  waiters: Array<(saved: boolean) => void>;
};

const initialState: SaveRecipeState = {
  type: "idle",
  message: "Choisis une recette ou crée-en une nouvelle.",
};

export class RecipeEditingSession {
  private readonly listeners = new Set<() => void>();
  private context: RecipeEditingContext;
  private currentDraft: RecipeDraftPayload;
  private lastSavedFingerprint: string;
  private loadedRecipeSlug: string;
  private pendingOfflinePayload: RecipeDraftPayload | null = null;
  private saveInFlight = false;
  private queuedSave: QueuedSave | null = null;
  private saveIdleWaiters: Array<() => void> = [];
  private conflictRetry: ((revision: number) => Promise<void>) | null = null;
  private destructiveOperationPending = false;
  private imageOperationPending = false;
  private disconnectEnvironment: (() => void) | null = null;
  private selectedRecipe?: SelectedRecipeSnapshot;
  private contextGeneration = 0;
  private snapshot: RecipeEditingSnapshot;

  readonly imageRevisionSession: RecipeImageRevisionSession;

  constructor({
    transport,
    environment,
    context,
    initialDraft,
    initialRevision,
    initialPublishedRevision,
    initialIsPublic,
    loadedRecipeSlug,
    selectedRecipe,
  }: {
    transport: RecipeEditingTransport;
    environment: RecipeEditingEnvironment;
    context: RecipeEditingContext;
    initialDraft: RecipeDraftPayload;
    initialRevision: number;
    initialPublishedRevision: number;
    initialIsPublic: boolean;
    loadedRecipeSlug: string;
    selectedRecipe?: SelectedRecipeSnapshot;
  }) {
    this.transport = transport;
    this.environment = environment;
    this.context = context;
    this.currentDraft = initialDraft;
    this.lastSavedFingerprint = draftFingerprint(initialDraft);
    this.loadedRecipeSlug = loadedRecipeSlug;
    this.selectedRecipe = selectedRecipe;
    this.snapshot = {
      state: initialState,
      isPending: false,
      syncState: "idle",
      revision: initialRevision,
      publishedRevision: initialPublishedRevision,
      isPublic: initialIsPublic,
      hasUnsavedChanges: false,
      deleted: false,
    };
    this.imageRevisionSession = createRecipeImageRevisionSession({
      getExpectedRevision: () => this.snapshot.revision,
      acceptSnapshot: (image) => this.acceptImageRevision(image.revision),
      registerConflict: (latestRevision, retry) =>
        this.registerConflict(latestRevision, retry),
      setPending: (pending) => {
        this.imageOperationPending = pending;
        this.refreshPendingState();
      },
    });
    this.refreshUnsavedState();
  }

  private readonly transport: RecipeEditingTransport;
  private readonly environment: RecipeEditingEnvironment;

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  connect = () => {
    if (this.disconnectEnvironment) return this.disconnectEnvironment;
    if (this.selectedRecipe) this.applySelectedRecipe(this.selectedRecipe);
    this.restoreLocalDraft(this.context.selectedSlug);
    const unsubscribeOnline = this.environment.subscribeOnline(() => {
      if (this.snapshot.syncState !== "offline") return;
      const payload = this.pendingOfflinePayload ?? this.currentDraft;
      void this.save(payload);
    });
    const unsubscribeLeaving = this.environment.subscribeLeaving(() => {
      this.persistCurrentDraft();
      this.flushCurrentDraftBeforeLeaving();
    });
    this.disconnectEnvironment = () => {
      unsubscribeOnline();
      unsubscribeLeaving();
      this.disconnectEnvironment = null;
    };
    return this.disconnectEnvironment;
  };

  updateContext({
    context,
    selectedRecipe,
  }: {
    context: RecipeEditingContext;
    selectedRecipe?: SelectedRecipeSnapshot;
  }) {
    const slugChanged = context.selectedSlug !== this.context.selectedSlug;
    this.context = context;
    this.selectedRecipe = selectedRecipe;
    if (slugChanged) {
      this.contextGeneration += 1;
      this.pendingOfflinePayload = null;
      this.conflictRetry = null;
      this.cancelQueuedSave();
      this.patchSnapshot({
        state: initialState,
        recoveredDraft: undefined,
        restoredImage: undefined,
        createdSlug: undefined,
        deleted: false,
        formResult: undefined,
        isPending: false,
        syncState: "idle",
        hasUnsavedChanges: false,
      });
      if (this.disconnectEnvironment) {
        if (selectedRecipe) {
          this.applySelectedRecipe(selectedRecipe);
        } else {
          this.lastSavedFingerprint = draftFingerprint(this.currentDraft);
          this.patchSnapshot({
            revision: 0,
            publishedRevision: -1,
            isPublic: false,
            hasUnsavedChanges: false,
          });
        }
        this.restoreLocalDraft(context.selectedSlug);
      } else {
        this.lastSavedFingerprint = draftFingerprint(this.currentDraft);
        this.patchSnapshot({
          revision: 0,
          publishedRevision: -1,
          isPublic: false,
          hasUnsavedChanges: false,
        });
      }
    } else if (selectedRecipe && this.disconnectEnvironment) {
      this.applySelectedRecipe(selectedRecipe);
    }
  }

  observeDraft(payload: RecipeDraftPayload) {
    this.currentDraft = payload;
    this.refreshUnsavedState();
  }

  async save(
    payload: RecipeDraftPayload,
    force = false,
    keepalive = false,
  ): Promise<boolean> {
    if (this.destructiveOperationPending) return false;
    if (this.saveInFlight) {
      return new Promise<boolean>((resolve) => {
        if (this.queuedSave) {
          this.queuedSave.payload = payload;
          this.queuedSave.force ||= force;
          this.queuedSave.keepalive ||= keepalive;
          this.queuedSave.waiters.push(resolve);
        } else {
          this.queuedSave = { payload, force, keepalive, waiters: [resolve] };
        }
      });
    }

    const normalized = normalizePayload(payload);
    this.currentDraft = normalized;
    const fingerprint = draftFingerprint(normalized);
    if (!force && fingerprint === this.lastSavedFingerprint) return true;

    if (!this.environment.isOnline()) {
      this.pendingOfflinePayload = normalized;
      if (this.context.selectedSlug) {
        this.persistRecovery(
          this.context.selectedSlug,
          normalized,
          this.snapshot.revision,
        );
      }
      this.patchSnapshot({ syncState: "offline" });
      return false;
    }

    this.saveInFlight = true;
    this.patchSnapshot({ isPending: true, syncState: "saving" });
    const operationGeneration = this.contextGeneration;
    const operationContext = this.context;
    const expectedRevision = this.snapshot.revision;
    let saved = false;
    try {
      const response = await this.transport.save({
        locale: operationContext.locale,
        mode: operationContext.mode,
        slug: operationContext.selectedSlug,
        recipePayload: JSON.stringify(normalized),
        expectedRevision,
        sourceIdeaId:
          operationContext.mode === "create"
            ? operationContext.sourceIdeaId
            : undefined,
        force,
        keepalive,
      });
      if (operationGeneration !== this.contextGeneration) return false;
      const data = response.data;
      this.patchSnapshot({ state: data, formResult: data });
      if (response.status === 409 || data.type === "conflict") {
        this.registerPublicationRetry();
        this.patchSnapshot({ syncState: "conflict" });
        return false;
      }
      if (!response.ok || data.type !== "success" || !data.slug) {
        this.patchSnapshot({ syncState: "error" });
        return false;
      }

      const nextRevision = data.revision ?? this.snapshot.revision;
      const wasCreate = operationContext.mode === "create";
      this.context = {
        ...this.context,
        mode: "update",
        selectedSlug: data.slug,
        sourceIdeaId: undefined,
      };
      this.loadedRecipeSlug = data.slug;
      this.lastSavedFingerprint = fingerprint;
      this.pendingOfflinePayload = null;
      this.environment.removeItem(recoveryKey(data.slug));
      this.environment.removeItem(pendingImageKey(data.slug));
      this.patchSnapshot({
        revision: nextRevision,
        publishedRevision:
          data.publishedRevision ?? this.snapshot.publishedRevision,
        isPublic:
          typeof data.isPublic === "boolean"
            ? data.isPublic
            : this.snapshot.isPublic,
        hasUnsavedChanges:
          draftFingerprint(this.currentDraft) !== this.lastSavedFingerprint,
        syncState: "saved",
        ...(wasCreate ? { createdSlug: data.slug } : {}),
      });
      saved = true;
    } catch {
      if (operationGeneration !== this.contextGeneration) return false;
      if (operationContext.selectedSlug) {
        this.persistRecovery(
          operationContext.selectedSlug,
          normalized,
          expectedRevision,
        );
      }
      this.pendingOfflinePayload = normalized;
      this.patchSnapshot({
        state: {
          type: "error",
          message: "Impossible d'enregistrer cette recette.",
        },
        syncState: this.environment.isOnline() ? "error" : "offline",
      });
    } finally {
      this.saveInFlight = false;
      this.refreshPendingState();
      const queued = this.queuedSave;
      this.queuedSave = null;
      if (queued && !this.destructiveOperationPending) {
        const queuedSaved = await this.save(
          queued.payload,
          queued.force,
          queued.keepalive,
        );
        saved = saved && queuedSaved;
        for (const resolve of queued.waiters) resolve(queuedSaved);
      } else if (queued) {
        for (const resolve of queued.waiters) resolve(false);
      }
      this.refreshPendingState();
      this.resolveIdleWaiters();
    }
    return saved;
  }

  recordValidationFailure(payload: RecipeDraftPayload) {
    if (this.context.selectedSlug) {
      this.persistRecovery(
        this.context.selectedSlug,
        payload,
        this.snapshot.revision,
      );
    }
    this.patchSnapshot({ syncState: "error" });
  }

  async publish(payload: RecipeDraftPayload, force = false): Promise<boolean> {
    if (!this.context.selectedSlug || this.destructiveOperationPending) {
      return false;
    }
    if (!this.environment.isOnline()) {
      this.persistCurrentDraft();
      this.patchSnapshot({
        state: {
          type: "error",
          message: "Reconnecte-toi, puis confirme à nouveau la publication.",
        },
        syncState: "offline",
      });
      return false;
    }

    this.currentDraft = payload;
    await this.imageRevisionSession.waitForIdle();
    if (!this.environment.isOnline()) return false;
    const saved = await this.save(this.currentDraft, force);
    if (!saved || !this.environment.isOnline()) return false;
    const wasNeverPublished = this.snapshot.publishedRevision < 0;
    const operationGeneration = this.contextGeneration;
    this.patchSnapshot({ isPending: true });
    try {
      const response = await this.transport.publish({
        slug: this.context.selectedSlug,
        expectedRevision: this.snapshot.revision,
      });
      if (operationGeneration !== this.contextGeneration) return false;
      const data = response.data;
      this.patchSnapshot({ state: data, formResult: data });
      if (!response.ok || data.type !== "success") {
        if (response.status === 409 || data.type === "conflict") {
          this.registerPublicationRetry();
        }
        this.patchSnapshot({
          syncState: response.status === 409 ? "conflict" : "error",
        });
        return false;
      }
      const publishedRevision =
        data.publishedRevision ?? data.revision ?? this.snapshot.revision;
      this.environment.removeItem(pendingImageKey(this.context.selectedSlug));
      this.patchSnapshot({
        revision: data.revision ?? this.snapshot.revision,
        publishedRevision,
        isPublic: wasNeverPublished ? true : this.snapshot.isPublic,
        syncState: "saved",
      });
      return true;
    } catch {
      if (operationGeneration !== this.contextGeneration) return false;
      this.patchSnapshot({
        state: {
          type: "error",
          message: "Impossible de publier les modifications.",
        },
        syncState: this.environment.isOnline() ? "error" : "offline",
      });
      return false;
    } finally {
      this.refreshPendingState();
    }
  }

  discard = async (): Promise<boolean> => {
    if (!this.context.selectedSlug || this.destructiveOperationPending) {
      return false;
    }
    this.destructiveOperationPending = true;
    this.patchSnapshot({ isPending: true });
    try {
      this.cancelQueuedSave();
      await this.waitForSaveIdle();
      await this.imageRevisionSession.waitForIdle();
      const response = await this.transport.discard({
        slug: this.context.selectedSlug,
        expectedRevision: this.snapshot.revision,
      });
      const data = response.data;
      this.patchSnapshot({ state: data, formResult: data });
      if (!response.ok || data.type !== "success" || !data.draft) {
        this.patchSnapshot({
          syncState: response.status === 409 ? "conflict" : "error",
        });
        return false;
      }
      this.currentDraft = data.draft;
      this.lastSavedFingerprint = draftFingerprint(data.draft);
      this.environment.removeItem(recoveryKey(this.context.selectedSlug));
      this.environment.removeItem(pendingImageKey(this.context.selectedSlug));
      const revision = data.revision ?? this.snapshot.revision;
      this.patchSnapshot({
        recoveredDraft: data.draft,
        restoredImage: {
          slug: this.context.selectedSlug,
          revision,
          heroImageUrl: data.heroImageUrl ?? "",
          imageCredit: data.imageCredit,
        },
        revision,
        publishedRevision: data.publishedRevision ?? revision,
        hasUnsavedChanges: false,
        syncState: "saved",
      });
      return true;
    } catch {
      this.patchSnapshot({
        state: {
          type: "error",
          message: "Impossible de revenir à la version publiée.",
        },
        syncState: "error",
      });
      return false;
    } finally {
      this.destructiveOperationPending = false;
      this.refreshPendingState();
    }
  };

  setVisibility = async (visible: boolean): Promise<boolean> => {
    if (!this.context.selectedSlug || this.destructiveOperationPending) {
      return false;
    }
    this.patchSnapshot({ isPending: true });
    try {
      const response = await this.transport.setVisibility({
        slug: this.context.selectedSlug,
        visible,
      });
      this.patchSnapshot({ state: response.data, formResult: response.data });
      if (!response.ok || response.data.type !== "success") {
        this.patchSnapshot({ syncState: "error" });
        return false;
      }
      this.patchSnapshot({ isPublic: visible, syncState: "saved" });
      return true;
    } catch {
      this.patchSnapshot({
        state: {
          type: "error",
          message: "Impossible de modifier la visibilité.",
        },
        syncState: "error",
      });
      return false;
    } finally {
      this.refreshPendingState();
    }
  };

  deleteRecipe = async (): Promise<boolean> => {
    if (!this.context.selectedSlug || this.destructiveOperationPending) {
      return false;
    }
    const operationGeneration = this.contextGeneration;
    const operationSlug = this.context.selectedSlug;
    this.destructiveOperationPending = true;
    try {
      this.cancelQueuedSave();
      await this.waitForSaveIdle();
      await this.imageRevisionSession.waitForIdle();
      if (operationGeneration !== this.contextGeneration) return false;
      const expectedRevision = this.snapshot.revision;
      this.patchSnapshot({ isPending: true });
      const response = await this.transport.deleteRecipe({
        slug: operationSlug,
        expectedRevision,
      });
      if (operationGeneration !== this.contextGeneration) return false;
      this.patchSnapshot({ state: response.data });
      if (!response.ok) {
        this.patchSnapshot({
          syncState: response.status === 409 ? "conflict" : "error",
        });
        return false;
      }
      this.environment.removeItem(recoveryKey(operationSlug));
      this.environment.removeItem(pendingImageKey(operationSlug));
      this.patchSnapshot({ syncState: "idle", deleted: true });
      return true;
    } catch {
      if (operationGeneration !== this.contextGeneration) return false;
      this.patchSnapshot({
        state: {
          type: "error",
          message: "Impossible de supprimer cette recette.",
        },
        syncState: "error",
      });
      return false;
    } finally {
      this.destructiveOperationPending = false;
      this.refreshPendingState();
    }
  };

  async replaceConflict(payload: RecipeDraftPayload) {
    const saved = await this.save(payload, true);
    if (!saved || !this.conflictRetry) return false;
    const retry = this.conflictRetry;
    this.conflictRetry = null;
    await retry(this.snapshot.revision);
    return true;
  }

  reloadLatest = () => {
    if (this.context.selectedSlug) {
      this.environment.removeItem(recoveryKey(this.context.selectedSlug));
    }
    this.environment.reload();
  };

  resetSyncState = () => {
    this.patchSnapshot({ syncState: "idle" });
  };

  private applySelectedRecipe(recipe: SelectedRecipeSnapshot) {
    if (recipe.slug !== this.context.selectedSlug) return;
    const hasPendingImage =
      this.environment.getItem(pendingImageKey(recipe.slug)) ===
      String(recipe.revision);
    if (
      recipe.slug !== this.loadedRecipeSlug ||
      recipe.revision > this.snapshot.revision
    ) {
      this.currentDraft = recipe.draft;
      this.loadedRecipeSlug = recipe.slug;
      this.lastSavedFingerprint = draftFingerprint(recipe.draft);
      this.patchSnapshot({
        recoveredDraft: recipe.draft,
        revision: recipe.revision,
        publishedRevision: recipe.publishedRevision,
        isPublic: recipe.isPublic,
      });
    }
    if (hasPendingImage) {
      this.lastSavedFingerprint = "pending-image-change";
    }
    const hasUnsavedChanges =
      hasPendingImage ||
      draftFingerprint(this.currentDraft) !== this.lastSavedFingerprint;
    if (hasUnsavedChanges !== this.snapshot.hasUnsavedChanges) {
      this.patchSnapshot({ hasUnsavedChanges });
    }
  }

  private restoreLocalDraft(slug: string) {
    if (!slug) return;
    const recovered = this.environment.getItem(recoveryKey(slug));
    if (!recovered) return;
    try {
      const parsed = JSON.parse(recovered) as {
        payload?: unknown;
        revision?: number;
      };
      const recoveredPayload = compatibleRecipeDraftSchema.safeParse(
        parsed.payload,
      );
      if (!recoveredPayload.success) return;
      this.currentDraft = recoveredPayload.data;
      this.patchSnapshot({ recoveredDraft: recoveredPayload.data });
      if (parsed.revision === this.snapshot.revision) {
        this.pendingOfflinePayload = recoveredPayload.data;
        this.patchSnapshot({ syncState: "offline" });
      } else {
        this.patchSnapshot({
          state: {
            type: "conflict",
            message:
              "Une récupération locale repose sur une révision plus ancienne.",
            latestRevision: this.snapshot.revision,
          },
          syncState: "conflict",
        });
      }
    } catch {
      this.environment.removeItem(recoveryKey(slug));
    }
  }

  private acceptImageRevision(nextRevision: number) {
    this.lastSavedFingerprint = "pending-image-change";
    if (this.context.selectedSlug) {
      this.environment.setItem(
        pendingImageKey(this.context.selectedSlug),
        String(nextRevision),
      );
    }
    this.patchSnapshot({
      revision: nextRevision,
      hasUnsavedChanges: true,
      syncState: "idle",
    });
  }

  private registerConflict(
    latestRevision?: number,
    retry?: (revision: number) => Promise<void>,
  ) {
    this.conflictRetry = retry ?? null;
    this.patchSnapshot({
      state: {
        type: "conflict",
        message: "Cette recette a été modifiée ailleurs.",
        latestRevision,
      },
      syncState: "conflict",
    });
  }

  private registerPublicationRetry() {
    this.conflictRetry = async () => {
      await this.publish(this.currentDraft);
    };
  }

  private persistCurrentDraft() {
    if (!this.context.selectedSlug) return;
    if (draftFingerprint(this.currentDraft) === this.lastSavedFingerprint) {
      return;
    }
    this.persistRecovery(
      this.context.selectedSlug,
      this.currentDraft,
      this.snapshot.revision,
    );
  }

  private flushCurrentDraftBeforeLeaving() {
    if (!this.context.selectedSlug || !this.environment.isOnline()) return;
    if (draftFingerprint(this.currentDraft) === this.lastSavedFingerprint) {
      return;
    }
    const parsed = compatibleRecipeDraftSchema.safeParse(this.currentDraft);
    if (!parsed.success) return;
    void this.save(parsed.data, false, true);
  }

  private persistRecovery(
    slug: string,
    payload: RecipeDraftPayload,
    revision: number,
  ) {
    this.environment.setItem(
      recoveryKey(slug),
      JSON.stringify({ payload, revision }),
    );
  }

  private refreshUnsavedState() {
    const hasUnsavedChanges =
      draftFingerprint(this.currentDraft) !== this.lastSavedFingerprint;
    if (hasUnsavedChanges !== this.snapshot.hasUnsavedChanges) {
      this.patchSnapshot({ hasUnsavedChanges });
    }
  }

  private cancelQueuedSave() {
    const queued = this.queuedSave;
    this.queuedSave = null;
    if (queued) {
      for (const resolve of queued.waiters) resolve(false);
    }
  }

  private waitForSaveIdle() {
    if (!this.saveInFlight) return Promise.resolve();
    return new Promise<void>((resolve) => this.saveIdleWaiters.push(resolve));
  }

  private resolveIdleWaiters() {
    if (this.saveInFlight || this.queuedSave) return;
    const waiters = this.saveIdleWaiters;
    this.saveIdleWaiters = [];
    for (const resolve of waiters) resolve();
  }

  private refreshPendingState() {
    const isPending =
      this.saveInFlight ||
      this.destructiveOperationPending ||
      this.imageOperationPending;
    if (isPending !== this.snapshot.isPending) {
      this.patchSnapshot({ isPending });
    }
  }

  private patchSnapshot(patch: Partial<RecipeEditingSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
}

export function createFetchRecipeEditingTransport(
  fetcher: typeof fetch = fetch,
): RecipeEditingTransport {
  return {
    async save(input) {
      const { keepalive, ...requestBody } = input;
      const response = await fetcher("/api/admin/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        keepalive,
      });
      return {
        ok: response.ok,
        status: response.status,
        data: (await response.json()) as SaveRecipeState,
      };
    },
    async deleteRecipe(input) {
      const response = await fetcher("/api/admin/recipes/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return {
        ok: response.ok,
        status: response.status,
        data: (await response.json()) as SaveRecipeState,
      };
    },
    async publish(input) {
      const response = await fetcher("/api/admin/recipes/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return {
        ok: response.ok,
        status: response.status,
        data: (await response.json()) as SaveRecipeState,
      };
    },
    async discard(input) {
      const response = await fetcher("/api/admin/recipes/discard-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return {
        ok: response.ok,
        status: response.status,
        data: (await response.json()) as SaveRecipeState,
      };
    },
    async setVisibility(input) {
      const response = await fetcher("/api/admin/recipes/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return {
        ok: response.ok,
        status: response.status,
        data: (await response.json()) as SaveRecipeState,
      };
    },
  };
}

export function createBrowserRecipeEditingEnvironment(): RecipeEditingEnvironment {
  return {
    isOnline: () =>
      typeof navigator === "undefined" || navigator.onLine,
    getItem: (key) =>
      typeof window === "undefined" ? null : window.localStorage.getItem(key),
    setItem: (key, value) => {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
    },
    subscribeOnline(listener) {
      if (typeof window === "undefined") return () => {};
      window.addEventListener("online", listener);
      return () => window.removeEventListener("online", listener);
    },
    subscribeLeaving(listener) {
      if (typeof window === "undefined") return () => {};
      window.addEventListener("pagehide", listener);
      window.addEventListener("popstate", listener);
      return () => {
        window.removeEventListener("pagehide", listener);
        window.removeEventListener("popstate", listener);
      };
    },
    reload: () => {
      if (typeof window !== "undefined") window.location.reload();
    },
  };
}

function normalizePayload(value: RecipeDraftPayload): RecipeDraftPayload {
  return {
    ...value,
    relatedRecipeSlugs: [
      ...new Set(
        value.relatedRecipeSlugs.flatMap((slug) =>
          slug.trim() ? [slug.trim()] : [],
        ),
      ),
    ],
    categories: [...new Set(value.categories ?? [])],
    legacyCategoryLabels: (value.legacyCategoryLabels ?? []).flatMap((label) =>
      label.trim() ? [label.trim()] : [],
    ),
    translations: {
      fr: normalizeLocalizedRecipe(value.translations.fr),
      en: normalizeLocalizedRecipe(value.translations.en),
    },
  };
}

type LocaleKey = "fr" | "en";

function draftFingerprint(value: RecipeDraftPayload) {
  const normalized = normalizePayload(value);
  return JSON.stringify({
    defaultLocale: normalized.defaultLocale,
    referenceServings: normalized.referenceServings,
    relatedRecipeSlugs: normalized.relatedRecipeSlugs,
    translations: normalized.translations,
    categories: normalized.categories,
    legacyCategoryLabels: normalized.legacyCategoryLabels,
  });
}

function normalizeLocalizedRecipe(
  recipe: RecipeDraftPayload["translations"][LocaleKey],
) {
  return {
    ...recipe,
    yieldLabel: recipe.yieldLabel.trim(),
    equipment: recipe.equipment.flatMap((item) =>
      item.trim() ? [item.trim()] : [],
    ),
    ingredients: recipe.ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name.trim(),
      quantity: ingredient.quantity.trim(),
      unit: ingredient.unit.trim(),
      notes: ingredient.notes.trim(),
    })),
    sections: recipe.sections.map((section) => ({
      title: section.title.trim(),
      steps: section.steps.flatMap((step) =>
        step.text.trim()
          ? [
              {
                ...step,
                text: step.text.trim(),
                ingredientUses: step.ingredientUses.map((use) => {
                  const quantity = use.amount?.quantity.trim() ?? "";
                  const unit = use.amount?.unit.trim() ?? "";
                  return {
                    ingredientId: use.ingredientId,
                    ...(quantity || unit
                      ? { amount: { quantity, unit } }
                      : {}),
                  };
                }),
              },
            ]
          : [],
      ),
    })),
    subRecipes: recipe.subRecipes.map((subRecipe) => ({
      title: subRecipe.title.trim(),
      ingredients: subRecipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name.trim(),
        quantity: ingredient.quantity.trim(),
        unit: ingredient.unit.trim(),
        notes: ingredient.notes.trim(),
      })),
    })),
    notes: recipe.notes.flatMap((note) =>
      note.trim() ? [note.trim()] : [],
    ),
  };
}

function recoveryKey(slug: string) {
  return `recipe-admin-draft:v1:${slug}`;
}

function pendingImageKey(slug: string) {
  return `recipe-admin-pending-image:v1:${slug}`;
}
