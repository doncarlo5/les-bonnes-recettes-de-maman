import type { Id } from "@/convex/_generated/dataModel";
import type {
  ImageMutationSuccess,
  MutationError,
} from "@/lib/recipe-admin-contracts";
import type { EditableRecipe, Recipe } from "./types";

export type RecipeMainImage = Pick<
  EditableRecipe,
  "slug" | "title" | "heroImageUrl" | "imageCredit"
>;

export type RecipeImageMutation = {
  revision: number;
  heroImageUrl: string;
  imageCredit?: Recipe["imageCredit"];
};

export type RecipeImageRevisionSession = {
  run(
    operation: (expectedRevision: number) => Promise<RecipeImageMutation>,
  ): Promise<RecipeImageMutation | null>;
  waitForIdle(): Promise<void>;
};

export function createRecipeImageRevisionSession({
  getExpectedRevision,
  acceptSnapshot,
  registerConflict,
  setPending = () => {},
}: {
  getExpectedRevision: () => number;
  acceptSnapshot: (snapshot: RecipeImageMutation) => void;
  registerConflict: (
    latestRevision: number | undefined,
    retry: (expectedRevision: number) => Promise<void>,
  ) => void;
  setPending?: (pending: boolean) => void;
}): RecipeImageRevisionSession {
  let operationsInFlight = 0;
  let idleWaiters: Array<() => void> = [];

  async function execute(
    operation: (expectedRevision: number) => Promise<RecipeImageMutation>,
    expectedRevision: number,
  ): Promise<RecipeImageMutation> {
    try {
      const snapshot = await operation(expectedRevision);
      acceptSnapshot(snapshot);
      return snapshot;
    } catch (error) {
      if (error instanceof RecipeImageConflictError) {
        registerConflict(error.latestRevision, async (nextRevision) => {
          try {
            await execute(operation, nextRevision);
          } catch (retryError) {
            if (!(retryError instanceof RecipeImageConflictError)) {
              throw retryError;
            }
          }
        });
      }
      throw error;
    }
  }

  return {
    async run(operation) {
      operationsInFlight += 1;
      if (operationsInFlight === 1) setPending(true);
      try {
        return await execute(operation, getExpectedRevision());
      } finally {
        operationsInFlight -= 1;
        if (operationsInFlight === 0) {
          setPending(false);
          const waiters = idleWaiters;
          idleWaiters = [];
          for (const resolve of waiters) resolve();
        }
      }
    },
    waitForIdle: () =>
      operationsInFlight === 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => idleWaiters.push(resolve)),
  };
}

export type RecipeImageCandidate = {
  key: string;
  source: "unsplash" | "openverse";
  previewUrl: string;
  title: string;
  detail: string;
};

export type RecipeMainImageAcquisitionState = {
  status: {
    type: "idle" | "loading" | "success" | "error";
    message: string;
  };
  searchQuery: string;
  candidates: {
    unsplash: RecipeImageCandidate[];
    openverse: RecipeImageCandidate[];
  };
  isDialogOpen: boolean;
  selectedUpload: File | null;
  preview: {
    url: string;
    credit?: Recipe["imageCredit"];
  };
};

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

type CleanupResult = {
  referenced: boolean;
  snapshot?: RecipeImageMutation & { slug: string; savedAt: number };
};

export type RecipeMainImageTransport = {
  searchUnsplash(query: string): Promise<UnsplashPhoto[]>;
  searchOpenverse(query: string): Promise<OpenversePhoto[]>;
  createUploadUrl(): Promise<string>;
  uploadLocalFile(
    uploadUrl: string,
    file: File,
  ): Promise<Id<"_storage">>;
  associateStoredImage(input: {
    slug: string;
    storageId: Id<"_storage">;
    expectedRevision: number;
  }): Promise<RecipeImageMutation>;
  trackUnsplashDownload(downloadLocation: string): Promise<void>;
  associateUnsplashImage(input: {
    slug: string;
    photo: UnsplashPhoto;
    expectedRevision: number;
  }): Promise<RecipeImageMutation>;
  importOpenverseImage(imageUrl: string): Promise<Id<"_storage">>;
  associateOpenverseImage(input: {
    slug: string;
    storageId: Id<"_storage">;
    photo: OpenversePhoto;
    expectedRevision: number;
  }): Promise<RecipeImageMutation>;
  cleanupStoredImage(input: {
    slug: string;
    storageId: Id<"_storage">;
  }): Promise<CleanupResult>;
};

type CandidateSource = UnsplashPhoto | OpenversePhoto;

const initialStatus = {
  type: "idle" as const,
  message: "Choisis une source pour remplacer l'image principale.",
};

const unavailableStatus = {
  type: "idle" as const,
  message: "Donne d'abord un titre à la recette avant d'ajouter une image principale.",
};

export class RecipeImageConflictError extends Error {
  constructor(
    message: string,
    readonly latestRevision?: number,
  ) {
    super(message);
    this.name = "RecipeImageConflictError";
  }
}

export class RecipeMainImageAcquisition {
  private listeners = new Set<() => void>();
  private candidateSources = new Map<string, CandidateSource>();
  private recipe: RecipeMainImage | null;
  private revisionSession: RecipeImageRevisionSession;
  private state: RecipeMainImageAcquisitionState;

  constructor(
    private readonly transport: RecipeMainImageTransport,
    recipe: RecipeMainImage | null,
    revisionSession: RecipeImageRevisionSession,
    private readonly notifySuccess: (message: string) => void = () => {},
  ) {
    this.recipe = recipe;
    this.revisionSession = revisionSession;
    this.state = initialAcquisitionState(recipe);
  }

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  updateContext(
    recipe: RecipeMainImage | null,
    revisionSession: RecipeImageRevisionSession,
  ) {
    this.revisionSession = revisionSession;
    if (recipe?.slug === this.recipe?.slug) {
      this.recipe = recipe;
      if (
        this.state.status.type !== "loading" &&
        (this.state.preview.url !== (recipe?.heroImageUrl ?? "") ||
          this.state.preview.credit !== recipe?.imageCredit)
      ) {
        this.patchState({
          preview: {
            url: recipe?.heroImageUrl ?? "",
            credit: recipe?.imageCredit,
          },
        });
      }
      return;
    }
    this.recipe = recipe;
    this.candidateSources.clear();
    this.replaceState(initialAcquisitionState(recipe));
  }

  setDialogOpen = (isDialogOpen: boolean) => {
    this.patchState({ isDialogOpen });
  };

  setSearchQuery = (searchQuery: string) => {
    this.patchState({ searchQuery });
  };

  clearSelectedUpload = () => {
    this.patchState({ selectedUpload: null });
  };

  search = async () => {
    const query = this.state.searchQuery.trim();
    if (!query) {
      this.setStatus(
        "error",
        "Ajoute quelques mots-clés pour chercher une image.",
      );
      return;
    }

    this.patchState({ isDialogOpen: true });
    this.setStatus("loading", "Recherche Unsplash et Openverse en cours…");
    const [unsplashResult, openverseResult] = await Promise.allSettled([
      this.transport.searchUnsplash(query),
      this.transport.searchOpenverse(query),
    ]);

    this.candidateSources.clear();
    const unsplash =
      unsplashResult.status === "fulfilled"
        ? unsplashResult.value.map((photo) => this.toCandidate(photo, "unsplash"))
        : [];
    const openverse =
      openverseResult.status === "fulfilled"
        ? openverseResult.value.map((photo) => this.toCandidate(photo, "openverse"))
        : [];
    const errors = [unsplashResult, openverseResult].flatMap((result) =>
      result.status === "rejected"
        ? [
            result.reason instanceof Error
              ? result.reason.message
              : "Une recherche a échoué.",
          ]
        : [],
    );

    this.patchState({
      candidates: { unsplash, openverse },
      status:
        errors.length > 0
          ? { type: "error", message: errors.join(" ") }
          : unsplash.length + openverse.length > 0
            ? {
                type: "success",
                message: `${unsplash.length + openverse.length} images trouvées.`,
              }
            : {
                type: "idle",
                message: "Aucune image trouvée pour ces mots-clés.",
              },
    });
  };

  uploadLocal = async (file: File | null) => {
    if (!this.recipe || !file) {
      this.setStatus("error", "Sélectionne une image avant d'uploader.");
      return;
    }
    this.patchState({ selectedUpload: file });
    this.setStatus("loading", "Préparation de l’image…");
    await this.runRevisionedChange(
      (expectedRevision) => this.uploadLocalAtRevision(file, expectedRevision),
      "Impossible d'associer cette image.",
    );
  };

  selectCandidate = async (key: string) => {
    const source = this.candidateSources.get(key);
    if (!this.recipe || !source) return;
    if (isUnsplashPhoto(source)) {
      await this.runRevisionedChange(
        (expectedRevision) =>
          this.useUnsplashAtRevision(source, expectedRevision),
        "Impossible d'associer cette image Unsplash.",
      );
      return;
    }
    await this.runRevisionedChange(
      (expectedRevision) =>
        this.useOpenverseAtRevision(source, expectedRevision),
      "Impossible d'associer cette image Openverse.",
    );
  };

  private async runRevisionedChange(
    operation: (expectedRevision: number) => Promise<RecipeImageMutation>,
    fallback: string,
  ) {
    try {
      const snapshot = await this.revisionSession.run(async (revision) => {
        const result = await operation(revision);
        this.applySnapshot(result);
        return result;
      });
      if (!snapshot) {
        this.setStatus(
          "error",
          "Enregistre ou corrige la recette avant de remplacer l’image.",
        );
      }
    } catch (error) {
      this.patchState({ selectedUpload: null });
      this.setStatus(
        "error",
        error instanceof Error ? error.message : fallback,
      );
    }
  }

  private async uploadLocalAtRevision(
    file: File,
    expectedRevision: number,
  ) {
    if (!this.recipe) throw new Error("RECIPE_NOT_FOUND");
    const slug = this.recipe.slug;
    this.setStatus("loading", "Upload de l’image…");
    return this.acquireAndAssociateStoredImage({
      acquireStorageId: async () => {
        const uploadUrl = await this.transport.createUploadUrl();
        return this.transport.uploadLocalFile(uploadUrl, file);
      },
      associateImage: (storageId) =>
        this.transport.associateStoredImage({
          slug,
          storageId,
          expectedRevision,
        }),
      cleanupFailure: "surface",
    });
  }

  private async useUnsplashAtRevision(
    photo: UnsplashPhoto,
    expectedRevision: number,
  ) {
    if (!this.recipe) throw new Error("RECIPE_NOT_FOUND");
    this.setStatus("loading", "Association de l’image Unsplash…");
    await this.transport.trackUnsplashDownload(photo.downloadLocation);
    return this.transport.associateUnsplashImage({
      slug: this.recipe.slug,
      photo,
      expectedRevision,
    });
  }

  private async useOpenverseAtRevision(
    photo: OpenversePhoto,
    expectedRevision: number,
  ) {
    if (!this.recipe) throw new Error("RECIPE_NOT_FOUND");
    const slug = this.recipe.slug;
    this.setStatus("loading", "Import de l’image Openverse dans Convex…");
    return this.acquireAndAssociateStoredImage({
      acquireStorageId: () =>
        this.transport.importOpenverseImage(photo.imageUrl),
      associateImage: (storageId) =>
        this.transport.associateOpenverseImage({
          slug,
          storageId,
          photo,
          expectedRevision,
        }),
      cleanupFailure: "preserve-association-error",
    });
  }

  private async acquireAndAssociateStoredImage({
    acquireStorageId,
    associateImage,
    cleanupFailure,
  }: {
    acquireStorageId: () => Promise<Id<"_storage">>;
    associateImage: (
      storageId: Id<"_storage">,
    ) => Promise<RecipeImageMutation>;
    cleanupFailure: "surface" | "preserve-association-error";
  }) {
    const storageId = await acquireStorageId();
    try {
      return await associateImage(storageId);
    } catch (associationError) {
      try {
        const recovered = await this.recoverStoredImage(storageId);
        if (recovered) return recovered;
      } catch (cleanupError) {
        if (cleanupFailure === "surface") throw cleanupError;
      }
      throw associationError;
    }
  }

  private async recoverStoredImage(storageId: Id<"_storage">) {
    if (!this.recipe) return null;
    const result = await this.transport.cleanupStoredImage({
      slug: this.recipe.slug,
      storageId,
    });
    if (result.referenced && result.snapshot?.slug === this.recipe.slug) {
      return result.snapshot;
    }
    return null;
  }

  private applySnapshot(snapshot: RecipeImageMutation) {
    this.patchState({
      preview: {
        url: snapshot.heroImageUrl,
        credit: snapshot.imageCredit,
      },
      selectedUpload: null,
      isDialogOpen: false,
      status: {
        type: "success",
        message: "Image associée en privé. Publie les modifications quand tout est prêt.",
      },
    });
    this.notifySuccess("Image principale remplacée.");
  }

  private toCandidate(
    source: CandidateSource,
    provider: "unsplash" | "openverse",
  ) {
    const key = `${provider}:${source.id}`;
    this.candidateSources.set(key, source);
    if (isUnsplashPhoto(source)) {
      return {
        key,
        source: provider,
        previewUrl: source.previewUrl,
        title: source.photographerName,
        detail: "Unsplash",
      } satisfies RecipeImageCandidate;
    }
    return {
      key,
      source: provider,
      previewUrl: source.previewUrl,
      title: source.title,
      detail: `${source.creator} · ${formatRecipeImageLicense(source)}`,
    } satisfies RecipeImageCandidate;
  }

  private setStatus(
    type: RecipeMainImageAcquisitionState["status"]["type"],
    message: string,
  ) {
    this.patchState({ status: { type, message } });
  }

  private patchState(patch: Partial<RecipeMainImageAcquisitionState>) {
    this.replaceState({ ...this.state, ...patch });
  }

  private replaceState(state: RecipeMainImageAcquisitionState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

export function createFetchRecipeMainImageTransport(
  fetcher: typeof fetch = fetch,
): RecipeMainImageTransport {
  return {
    async searchUnsplash(query) {
      const response = await fetcher(
        `/api/admin/unsplash/search?query=${encodeURIComponent(query)}`,
      );
      const data = await readJsonResponse<
        { results?: UnsplashPhoto[] } & ApiErrorResponse
      >(response);
      if (!response.ok) {
        throw new Error(data.error ?? "La recherche Unsplash a échoué.");
      }
      return data.results ?? [];
    },
    async searchOpenverse(query) {
      const response = await fetcher(
        `/api/admin/openverse/search?query=${encodeURIComponent(query)}`,
      );
      const data = await readJsonResponse<
        { results?: OpenversePhoto[] } & ApiErrorResponse
      >(response);
      if (!response.ok) {
        throw new Error(data.error ?? "La recherche Openverse a échoué.");
      }
      return data.results ?? [];
    },
    async createUploadUrl() {
      const response = await fetcher("/api/admin/recipes/upload-url", {
        method: "POST",
      });
      const data = await readJsonResponse<
        { uploadUrl?: string } & ApiErrorResponse
      >(response);
      if (!response.ok || !data.uploadUrl) {
        throw new Error(
          data.error ?? data.message ?? "Impossible de préparer l’upload.",
        );
      }
      return data.uploadUrl;
    },
    async uploadLocalFile(uploadUrl, file) {
      const response = await fetcher(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Convex Storage a refusé l’upload.");
      return (await readJsonResponse<{ storageId: Id<"_storage"> }>(response))
        .storageId;
    },
    async associateStoredImage(input) {
      return mutationRequest(
        fetcher,
        "/api/admin/recipes/hero-image",
        input,
        "Impossible d'associer cette image.",
      );
    },
    async trackUnsplashDownload(downloadLocation) {
      const response = await fetcher("/api/admin/unsplash/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadLocation }),
      });
      const data = await readJsonResponse<ApiErrorResponse>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Le tracking Unsplash a échoué.");
      }
    },
    async associateUnsplashImage({ slug, photo, expectedRevision }) {
      return mutationRequest(
        fetcher,
        "/api/admin/recipes/unsplash-hero-image",
        {
          slug,
          imageUrl: photo.imageUrl,
          alt: photo.alt,
          photographerName: photo.photographerName,
          photographerUrl: photo.photographerUrl,
          photoUrl: photo.photoUrl,
          expectedRevision,
        },
        "Impossible d'associer cette image Unsplash.",
      );
    },
    async importOpenverseImage(imageUrl) {
      const response = await fetcher("/api/admin/openverse/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await readJsonResponse<
        { storageId?: Id<"_storage"> } & ApiErrorResponse
      >(response);
      if (!response.ok || !data.storageId) {
        throw new Error(
          data.message ?? data.error ?? "L’import Openverse a échoué.",
        );
      }
      return data.storageId;
    },
    async associateOpenverseImage({
      slug,
      storageId,
      photo,
      expectedRevision,
    }) {
      return mutationRequest(
        fetcher,
        "/api/admin/recipes/openverse-hero-image",
        {
          slug,
          storageId,
          imageCredit: {
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
          },
          expectedRevision,
        },
        "L’association Openverse a échoué.",
      );
    },
    async cleanupStoredImage({ slug, storageId }) {
      const response = await fetcher("/api/admin/recipes/cleanup-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, storageId }),
      });
      const data = await readJsonResponse<
        {
          referenced?: boolean;
          slug?: string;
          revision?: number;
          savedAt?: number;
          heroImageUrl?: string;
          imageCredit?: Recipe["imageCredit"];
        } & ApiErrorResponse
      >(response);
      const hasSnapshot =
        response.ok &&
        data.referenced &&
        typeof data.slug === "string" &&
        typeof data.revision === "number" &&
        typeof data.savedAt === "number" &&
        typeof data.heroImageUrl === "string";
      return {
        referenced: Boolean(data.referenced),
        ...(hasSnapshot
          ? {
              snapshot: {
                slug: data.slug as string,
                revision: data.revision as number,
                savedAt: data.savedAt as number,
                heroImageUrl: data.heroImageUrl as string,
                imageCredit: data.imageCredit,
              },
            }
          : {}),
      };
    },
  };
}

type ApiErrorResponse = {
  error?: string;
  type?: MutationError["type"];
  message?: string;
  latestRevision?: number;
};

async function mutationRequest(
  fetcher: typeof fetch,
  url: string,
  body: unknown,
  fallback: string,
) {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<
    ImageMutationSuccess | ApiErrorResponse
  >(response);
  if (!response.ok) {
    const error = data as ApiErrorResponse;
    if (response.status === 409 || error.type === "conflict") {
      throw new RecipeImageConflictError(
        error.message ?? fallback,
        error.latestRevision,
      );
    }
    throw new Error(error.message ?? error.error ?? fallback);
  }
  if (
    data.type !== "success" ||
    typeof data.revision !== "number" ||
    typeof data.heroImageUrl !== "string"
  ) {
    throw new Error("La réponse d’image ne contient pas de révision.");
  }
  return data;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
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

function initialAcquisitionState(
  recipe: RecipeMainImage | null,
): RecipeMainImageAcquisitionState {
  return {
    status: recipe ? initialStatus : unavailableStatus,
    searchQuery: recipe?.title ?? "",
    candidates: { unsplash: [], openverse: [] },
    isDialogOpen: false,
    selectedUpload: null,
    preview: {
      url: recipe?.heroImageUrl ?? "",
      credit: recipe?.imageCredit,
    },
  };
}

function isUnsplashPhoto(photo: CandidateSource): photo is UnsplashPhoto {
  return "photographerName" in photo;
}

export function formatRecipeImageLicense({
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
