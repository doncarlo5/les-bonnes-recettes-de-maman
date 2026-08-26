import type { Id } from "@/convex/_generated/dataModel";
import { describe, expect, test, vi } from "vitest";
import {
  createFetchRecipeMainImageTransport,
  createRecipeImageRevisionSession,
  RecipeImageConflictError,
  RecipeMainImageAcquisition,
  type RecipeImageRevisionSession,
  type RecipeMainImageTransport,
} from "./recipe-main-image-acquisition";

const recipe = {
  slug: "tarte-citron",
  title: "Tarte au citron",
  heroImageUrl: "/old.jpg",
};

const storageId = "storage-image" as Id<"_storage">;
const openversePhoto = {
  id: "o1",
  title: "Tarte au citron",
  imageUrl: "https://images.test/o1.jpg",
  previewUrl: "https://images.test/o1-small.jpg",
  landingUrl: "https://openverse.test/o1",
  creator: "Bob",
  creatorUrl: "https://openverse.test/bob",
  license: "by",
  licenseVersion: "4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  source: "Wikimedia Commons",
  attribution: "Tarte au citron — Bob — CC BY 4.0",
  alt: "Une tarte au citron",
};

function revisionSession(revision = 4): RecipeImageRevisionSession {
  return {
    run: async (operation) => operation(revision),
    waitForIdle: () => Promise.resolve(),
  };
}

function transport(
  overrides: Partial<RecipeMainImageTransport> = {},
): RecipeMainImageTransport {
  return {
    searchUnsplash: vi.fn().mockResolvedValue([]),
    searchOpenverse: vi.fn().mockResolvedValue([]),
    createUploadUrl: vi.fn().mockResolvedValue("https://upload.test"),
    uploadLocalFile: vi.fn().mockResolvedValue(storageId),
    associateStoredImage: vi.fn().mockResolvedValue({
      revision: 5,
      heroImageUrl: "/local.jpg",
    }),
    trackUnsplashDownload: vi.fn().mockResolvedValue(undefined),
    associateUnsplashImage: vi.fn().mockResolvedValue({
      revision: 5,
      heroImageUrl: "/unsplash.jpg",
    }),
    importOpenverseImage: vi.fn().mockResolvedValue(storageId),
    associateOpenverseImage: vi.fn().mockResolvedValue({
      revision: 5,
      heroImageUrl: "/openverse.jpg",
    }),
    cleanupStoredImage: vi.fn().mockResolvedValue({ referenced: false }),
    ...overrides,
  };
}

describe("RecipeMainImageAcquisition", () => {
  test("refreshes the preview when the same recipe is restored", () => {
    const acquisition = new RecipeMainImageAcquisition(
      transport(),
      recipe,
      revisionSession(),
    );

    acquisition.updateContext(
      { ...recipe, heroImageUrl: "/published.jpg" },
      revisionSession(7),
    );

    expect(acquisition.getSnapshot().preview.url).toBe("/published.jpg");
  });

  test("normalizes both providers while preserving a partial search failure", async () => {
    const adapter = transport({
      searchUnsplash: vi.fn().mockResolvedValue([
        {
          id: "u1",
          imageUrl: "https://images.test/u1.jpg",
          previewUrl: "https://images.test/u1-small.jpg",
          alt: "Une tarte",
          photographerName: "Alice",
          photographerUrl: "https://unsplash.test/alice",
          photoUrl: "https://unsplash.test/u1",
          downloadLocation: "https://api.unsplash.test/u1/download",
        },
      ]),
      searchOpenverse: vi.fn().mockRejectedValue(new Error("Openverse indisponible.")),
    });
    const acquisition = new RecipeMainImageAcquisition(
      adapter,
      recipe,
      revisionSession(),
    );

    acquisition.setSearchQuery("  tarte citron  ");
    await acquisition.search();

    expect(adapter.searchUnsplash).toHaveBeenCalledWith("tarte citron");
    expect(adapter.searchOpenverse).toHaveBeenCalledWith("tarte citron");
    expect(acquisition.getSnapshot()).toMatchObject({
      candidates: {
        unsplash: [
          {
            key: "unsplash:u1",
            source: "unsplash",
            title: "Alice",
            detail: "Unsplash",
          },
        ],
        openverse: [],
      },
      status: { type: "error", message: "Openverse indisponible." },
    });
  });

  test("uploads and associates a local file through the revision session", async () => {
    const adapter = transport();
    const notify = vi.fn();
    const session = revisionSession(8);
    const acquisition = new RecipeMainImageAcquisition(
      adapter,
      recipe,
      session,
      notify,
    );
    acquisition.setDialogOpen(true);
    const file = new File(["image"], "tarte.jpg", { type: "image/jpeg" });

    await acquisition.uploadLocal(file);

    expect(adapter.associateStoredImage).toHaveBeenCalledWith({
      slug: recipe.slug,
      storageId,
      expectedRevision: 8,
    });
    expect(adapter.cleanupStoredImage).not.toHaveBeenCalled();
    expect(acquisition.getSnapshot()).toMatchObject({
      preview: { url: "/local.jpg" },
      selectedUpload: null,
      isDialogOpen: false,
      status: { type: "success" },
    });
    expect(notify).toHaveBeenCalledWith("Image principale remplacée.");
  });

  test("deletes an orphaned local upload when association fails", async () => {
    const associationError = new Error("Association refusée.");
    const adapter = transport({
      associateStoredImage: vi.fn().mockRejectedValue(associationError),
    });
    const acquisition = new RecipeMainImageAcquisition(
      adapter,
      recipe,
      revisionSession(),
    );

    await acquisition.uploadLocal(
      new File(["image"], "tarte.jpg", { type: "image/jpeg" }),
    );

    expect(adapter.cleanupStoredImage).toHaveBeenCalledWith({
      slug: recipe.slug,
      storageId,
    });
    expect(acquisition.getSnapshot().status).toEqual({
      type: "error",
      message: "Association refusée.",
    });
  });

  test("accepts the authoritative snapshot when cleanup finds a referenced upload", async () => {
    const adapter = transport({
      associateStoredImage: vi.fn().mockRejectedValue(new Error("Réponse perdue.")),
      cleanupStoredImage: vi.fn().mockResolvedValue({
        referenced: true,
        snapshot: {
          slug: recipe.slug,
          revision: 7,
          savedAt: 123,
          heroImageUrl: "/already-associated.jpg",
        },
      }),
    });
    const acquisition = new RecipeMainImageAcquisition(
      adapter,
      recipe,
      revisionSession(),
    );

    await acquisition.uploadLocal(
      new File(["image"], "tarte.jpg", { type: "image/jpeg" }),
    );

    expect(acquisition.getSnapshot()).toMatchObject({
      preview: { url: "/already-associated.jpg" },
      status: { type: "success" },
    });
  });

  test("tracks Unsplash before associating the selected normalized candidate", async () => {
    const calls: string[] = [];
    const adapter = transport({
      searchUnsplash: vi.fn().mockResolvedValue([
        {
          id: "u1",
          imageUrl: "https://images.test/u1.jpg",
          previewUrl: "https://images.test/u1-small.jpg",
          alt: "Une tarte",
          photographerName: "Alice",
          photographerUrl: "https://unsplash.test/alice",
          photoUrl: "https://unsplash.test/u1",
          downloadLocation: "https://api.unsplash.test/u1/download",
        },
      ]),
      trackUnsplashDownload: vi.fn(async () => {
        calls.push("track");
      }),
      associateUnsplashImage: vi.fn(async () => {
        calls.push("associate");
        return { revision: 5, heroImageUrl: "/unsplash.jpg" };
      }),
    });
    const acquisition = new RecipeMainImageAcquisition(
      adapter,
      recipe,
      revisionSession(),
    );
    await acquisition.search();

    await acquisition.selectCandidate("unsplash:u1");

    expect(calls).toEqual(["track", "associate"]);
    expect(acquisition.getSnapshot().preview.url).toBe("/unsplash.jpg");
  });

  test("cleans up Openverse storage while preserving the association error", async () => {
    const adapter = transport({
      searchOpenverse: vi.fn().mockResolvedValue([openversePhoto]),
      associateOpenverseImage: vi
        .fn()
        .mockRejectedValue(new Error("Association Openverse refusée.")),
      cleanupStoredImage: vi
        .fn()
        .mockRejectedValue(new Error("Nettoyage indisponible.")),
    });
    const acquisition = new RecipeMainImageAcquisition(
      adapter,
      recipe,
      revisionSession(),
    );
    await acquisition.search();

    await acquisition.selectCandidate("openverse:o1");

    expect(adapter.cleanupStoredImage).toHaveBeenCalledWith({
      slug: recipe.slug,
      storageId,
    });
    expect(acquisition.getSnapshot().status).toEqual({
      type: "error",
      message: "Association Openverse refusée.",
    });
  });
});

describe("createFetchRecipeMainImageTransport", () => {
  test("translates the existing 409 contract into a typed revision conflict", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "conflict",
          message: "Cette recette a été modifiée ailleurs.",
          latestRevision: 12,
        }),
        { status: 409 },
      ),
    );
    const adapter = createFetchRecipeMainImageTransport(fetcher);

    await expect(
      adapter.associateUnsplashImage({
        slug: recipe.slug,
        photo: {
          id: "u1",
          imageUrl: "https://images.test/u1.jpg",
          previewUrl: "https://images.test/u1-small.jpg",
          alt: "Une tarte",
          photographerName: "Alice",
          photographerUrl: "https://unsplash.test/alice",
          photoUrl: "https://unsplash.test/u1",
          downloadLocation: "https://api.unsplash.test/u1/download",
        },
        expectedRevision: 11,
      }),
    ).rejects.toMatchObject({
      name: "RecipeImageConflictError",
      latestRevision: 12,
    });
  });
});

describe("createRecipeImageRevisionSession", () => {
  test("registers every consecutive conflict for retry at the next revision", async () => {
    const acceptSnapshot = vi.fn();
    const retries: Array<(expectedRevision: number) => Promise<void>> = [];
    const session = createRecipeImageRevisionSession({
      getExpectedRevision: () => 11,
      acceptSnapshot,
      registerConflict: (_latestRevision, registeredRetry) => {
        retries.push(registeredRetry);
      },
    });
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new RecipeImageConflictError("Conflit", 12))
      .mockRejectedValueOnce(new RecipeImageConflictError("Conflit", 13))
      .mockResolvedValueOnce({
        revision: 14,
        heroImageUrl: "/retried.jpg",
      });

    await expect(session.run(operation)).rejects.toBeInstanceOf(
      RecipeImageConflictError,
    );
    expect(operation).toHaveBeenCalledWith(11);
    expect(retries).toHaveLength(1);

    await expect(retries[0](12)).resolves.toBeUndefined();
    expect(retries).toHaveLength(2);

    await retries[1](13);

    expect(operation).toHaveBeenLastCalledWith(13);
    expect(acceptSnapshot).toHaveBeenCalledWith({
      revision: 14,
      heroImageUrl: "/retried.jpg",
    });
  });
});
