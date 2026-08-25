import { describe, expect, test, vi } from "vitest";
import {
  RecipeDraftSyncSession,
  type RecipeDraftSyncEnvironment,
  type RecipeDraftSyncTransport,
  type SaveRecipeState,
} from "./recipe-draft-sync-session";
import { RecipeImageConflictError } from "./recipe-main-image-acquisition";
import type { RecipeDraftPayload } from "./recipe-form-schema";

function draft(title = "Tarte au citron"): RecipeDraftPayload {
  const localized = {
    title,
    author: "Maman",
    description: "Une tarte acidulée.",
    yieldLabel: "6 personnes",
    prepTime: "20 min",
    cookTime: "30 min",
    restTime: "",
    totalTime: "50 min",
    timeLabel: "50 min",
    temperature: "180 °C",
    equipment: [],
    ingredients: [
      {
        id: "ingredient-1",
        name: "Citron",
        quantity: "2",
        unit: "",
        notes: "",
      },
    ],
    sections: [
      {
        title: "Préparation",
        steps: [
          {
            id: "step-1",
            text: "Mélanger.",
            ingredientUses: [{ ingredientId: "ingredient-1" }],
          },
        ],
      },
    ],
    subRecipes: [],
    notes: [],
  };
  return {
    defaultLocale: "fr",
    referenceServings: 6,
    relatedRecipeSlugs: [],
    translations: {
      fr: localized,
      en: { ...localized, title: `${title} EN` },
    },
    categories: ["dessert"],
    legacyCategoryLabels: [],
  };
}

function success(
  revision: number,
  slug = "tarte-au-citron",
): { ok: boolean; status: number; data: SaveRecipeState } {
  return {
    ok: true,
    status: 200,
    data: {
      type: "success",
      message: "Enregistré",
      slug,
      revision,
      savedAt: revision,
    },
  };
}

function transport(
  overrides: Partial<RecipeDraftSyncTransport> = {},
): RecipeDraftSyncTransport {
  return {
    save: vi.fn().mockResolvedValue(success(4)),
    deleteRecipe: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        type: "success",
        message: "Supprimé",
        slug: "tarte-au-citron",
      },
    }),
    ...overrides,
  };
}

type TestEnvironment = RecipeDraftSyncEnvironment & {
  entries: Map<string, string>;
  setOnline(value: boolean): void;
  leave(): void;
  reloaded: ReturnType<typeof vi.fn>;
};

function environment({
  online = true,
  entries = new Map<string, string>(),
}: {
  online?: boolean;
  entries?: Map<string, string>;
} = {}): TestEnvironment {
  let isOnline = online;
  const onlineListeners = new Set<() => void>();
  const leavingListeners = new Set<() => void>();
  const reloaded = vi.fn();
  return {
    entries,
    isOnline: () => isOnline,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => {
      entries.delete(key);
    },
    subscribeOnline(listener) {
      onlineListeners.add(listener);
      return () => onlineListeners.delete(listener);
    },
    subscribeLeaving(listener) {
      leavingListeners.add(listener);
      return () => leavingListeners.delete(listener);
    },
    reload: reloaded,
    setOnline(value) {
      isOnline = value;
      if (value) for (const listener of onlineListeners) listener();
    },
    leave() {
      for (const listener of leavingListeners) listener();
    },
    reloaded,
  };
}

function session({
  adapter = transport(),
  browser = environment(),
  initialDraft = draft(),
  revision = 3,
  mode = "update" as const,
  slug = "tarte-au-citron",
}: {
  adapter?: RecipeDraftSyncTransport;
  browser?: RecipeDraftSyncEnvironment;
  initialDraft?: RecipeDraftPayload;
  revision?: number;
  mode?: "create" | "update";
  slug?: string;
} = {}) {
  return new RecipeDraftSyncSession({
    transport: adapter,
    environment: browser,
    context: {
      locale: "fr",
      mode,
      selectedSlug: slug,
    },
    initialDraft,
    initialRevision: revision,
    initialIsPublic: false,
    loadedRecipeSlug: slug,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("RecipeDraftSyncSession", () => {
  test("skips a semantically identical draft", async () => {
    const adapter = transport();
    const sync = session({ adapter });

    await expect(sync.save(draft())).resolves.toBe(true);

    expect(adapter.save).not.toHaveBeenCalled();
    expect(sync.getSnapshot().syncState).toBe("idle");
  });

  test("coalesces saves with latest-write-wins and sticky force", async () => {
    const firstResponse = deferred<ReturnType<typeof success>>();
    const adapter = transport({
      save: vi
        .fn()
        .mockImplementationOnce(() => firstResponse.promise)
        .mockResolvedValueOnce(success(5)),
    });
    const sync = session({ adapter });

    const first = sync.save(draft("Première version"));
    const second = sync.save(draft("Version intermédiaire"));
    const latest = sync.save(draft("Version finale"), true);
    firstResponse.resolve(success(4));

    await expect(Promise.all([first, second, latest])).resolves.toEqual([
      true,
      true,
      true,
    ]);
    expect(adapter.save).toHaveBeenCalledTimes(2);
    const finalRequest = vi.mocked(adapter.save).mock.calls[1][0];
    expect(finalRequest.force).toBe(true);
    expect(JSON.parse(finalRequest.recipePayload)).toMatchObject({
      translations: { fr: { title: "Version finale" } },
    });
  });

  test("persists offline and retries when the environment comes online", async () => {
    const browser = environment({ online: false });
    const adapter = transport();
    const sync = session({ adapter, browser });
    const disconnect = sync.connect();

    await expect(sync.save(draft("Version hors ligne"))).resolves.toBe(false);
    expect(sync.getSnapshot().syncState).toBe("offline");
    expect(
      browser.entries.get("recipe-admin-draft:v1:tarte-au-citron"),
    ).toContain("Version hors ligne");

    browser.setOnline(true);
    await vi.waitFor(() => expect(adapter.save).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(sync.getSnapshot().syncState).toBe("saved"));
    disconnect();
  });

  test("restores compatible local progress at the matching revision", () => {
    const browser = environment({
      entries: new Map([
        [
          "recipe-admin-draft:v1:tarte-au-citron",
          JSON.stringify({ payload: draft("Version restaurée"), revision: 3 }),
        ],
      ]),
    });

    const sync = session({ browser });
    sync.connect();

    expect(sync.getSnapshot()).toMatchObject({
      syncState: "offline",
      recoveredDraft: {
        translations: { fr: { title: "Version restaurée" } },
      },
    });
  });

  test("restores the newly selected recipe against its own revision", () => {
    const browser = environment({
      entries: new Map([
        [
          "recipe-admin-draft:v1:cake-au-citron",
          JSON.stringify({ payload: draft("Cake local"), revision: 8 }),
        ],
      ]),
    });
    const sync = session({ browser });
    sync.connect();

    sync.updateContext({
      context: {
        locale: "fr",
        mode: "update",
        selectedSlug: "cake-au-citron",
      },
      selectedRecipe: {
        slug: "cake-au-citron",
        revision: 8,
        isPublic: true,
        draft: draft("Cake enregistré"),
      },
    });

    expect(sync.getSnapshot()).toMatchObject({
      revision: 8,
      isPublic: true,
      syncState: "offline",
      recoveredDraft: {
        translations: { fr: { title: "Cake local" } },
      },
    });
  });

  test("resets recipe-scoped conflict state when the slug changes", async () => {
    const adapter = transport({
      save: vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        data: {
          type: "conflict",
          message: "Conflit",
          latestRevision: 4,
        },
      }),
    });
    const sync = session({ adapter });
    sync.connect();
    await sync.save(draft("Version en conflit"));

    sync.updateContext({
      context: {
        locale: "fr",
        mode: "update",
        selectedSlug: "cake-au-citron",
      },
      selectedRecipe: {
        slug: "cake-au-citron",
        revision: 8,
        isPublic: false,
        draft: draft("Cake enregistré"),
      },
    });

    expect(sync.getSnapshot()).toMatchObject({
      state: { type: "idle" },
      syncState: "idle",
      revision: 8,
    });
  });

  test("ignores an in-flight save after switching recipes", async () => {
    const firstResponse = deferred<ReturnType<typeof success>>();
    const adapter = transport({
      save: vi
        .fn()
        .mockImplementationOnce(() => firstResponse.promise)
        .mockResolvedValueOnce(success(9, "cake-au-citron")),
    });
    const sync = session({ adapter });
    sync.connect();

    const staleSave = sync.save(draft("Tarte en cours"));
    sync.updateContext({
      context: {
        locale: "fr",
        mode: "update",
        selectedSlug: "cake-au-citron",
      },
      selectedRecipe: {
        slug: "cake-au-citron",
        revision: 8,
        isPublic: false,
        draft: draft("Cake enregistré"),
      },
    });
    sync.observeDraft(draft("Cake modifié"));
    const currentSave = sync.save(draft("Cake modifié"));
    firstResponse.resolve(success(4));

    await expect(staleSave).resolves.toBe(false);
    await expect(currentSave).resolves.toBe(true);
    expect(vi.mocked(adapter.save).mock.calls[1][0]).toMatchObject({
      slug: "cake-au-citron",
      expectedRevision: 8,
    });
    expect(sync.getSnapshot()).toMatchObject({
      state: { type: "success", slug: "cake-au-citron" },
      revision: 9,
      syncState: "saved",
    });
  });

  test("surfaces a conflict for recovery based on an older revision", () => {
    const browser = environment({
      entries: new Map([
        [
          "recipe-admin-draft:v1:tarte-au-citron",
          JSON.stringify({ payload: draft("Version ancienne"), revision: 2 }),
        ],
      ]),
    });

    const sync = session({ browser });
    sync.connect();

    expect(sync.getSnapshot()).toMatchObject({
      syncState: "conflict",
      state: { type: "conflict", latestRevision: 3 },
    });
  });

  test("removes an unreadable recovery record", () => {
    const key = "recipe-admin-draft:v1:tarte-au-citron";
    const browser = environment({ entries: new Map([[key, "not-json"]]) });

    session({ browser }).connect();

    expect(browser.entries.has(key)).toBe(false);
  });

  test("persists a dirty draft when the environment is leaving", () => {
    const browser = environment();
    const sync = session({ browser });
    const disconnect = sync.connect();
    sync.observeDraft(draft("Version non enregistrée"));

    browser.leave();

    expect(
      browser.entries.get("recipe-admin-draft:v1:tarte-au-citron"),
    ).toContain("Version non enregistrée");
    disconnect();
  });

  test("keeps registering image retries across consecutive conflicts", async () => {
    const adapter = transport({
      save: vi
        .fn()
        .mockResolvedValueOnce(success(4))
        .mockResolvedValueOnce(success(5)),
    });
    const browser = environment();
    const sync = session({ adapter, browser });
    const imageOperation = vi
      .fn()
      .mockRejectedValueOnce(new RecipeImageConflictError("Conflit", 4))
      .mockRejectedValueOnce(new RecipeImageConflictError("Conflit", 5))
      .mockResolvedValueOnce({ revision: 6, heroImageUrl: "/hero.jpg" });

    await expect(
      sync.imageRevisionSession.run(imageOperation),
    ).rejects.toBeInstanceOf(RecipeImageConflictError);
    expect(sync.getSnapshot().syncState).toBe("conflict");

    await expect(sync.replaceConflict(draft())).resolves.toBe(true);
    expect(sync.getSnapshot().syncState).toBe("conflict");

    await expect(sync.replaceConflict(draft())).resolves.toBe(true);
    expect(imageOperation).toHaveBeenLastCalledWith(5);
    expect(sync.getSnapshot()).toMatchObject({
      revision: 6,
      syncState: "idle",
      hasUnsavedChanges: true,
    });
    expect(
      browser.entries.get("recipe-admin-pending-image:v1:tarte-au-citron"),
    ).toBe("6");
  });

  test("cancels queued saves and waits for the active save before deletion", async () => {
    const calls: string[] = [];
    const activeResponse = deferred<ReturnType<typeof success>>();
    const adapter = transport({
      save: vi.fn(async () => {
        calls.push("save");
        return activeResponse.promise;
      }),
      deleteRecipe: vi.fn(async () => {
        calls.push("delete");
        return {
          ok: true,
          status: 200,
          data: {
            type: "success" as const,
            message: "Supprimé",
            slug: "tarte-au-citron",
          },
        };
      }),
    });
    const sync = session({ adapter });

    const activeSave = sync.save(draft("Sauvegarde active"));
    const queuedSave = sync.save(draft("Sauvegarde annulée"));
    const deletion = sync.deleteRecipe();

    await expect(queuedSave).resolves.toBe(false);
    expect(calls).toEqual(["save"]);
    activeResponse.resolve(success(4));

    await expect(activeSave).resolves.toBe(true);
    await expect(deletion).resolves.toBe(true);
    expect(calls).toEqual(["save", "delete"]);
    expect(adapter.deleteRecipe).toHaveBeenCalledWith({
      slug: "tarte-au-citron",
      expectedRevision: 4,
    });
  });

  test("ignores an in-flight deletion after switching recipes", async () => {
    const deleteResponse = deferred<{
      ok: boolean;
      status: number;
      data: SaveRecipeState;
    }>();
    const adapter = transport({
      deleteRecipe: vi.fn(() => deleteResponse.promise),
    });
    const cakeRecovery = JSON.stringify({
      payload: draft("Cake local"),
      revision: 8,
    });
    const browser = environment({
      entries: new Map([
        ["recipe-admin-draft:v1:cake-au-citron", cakeRecovery],
      ]),
    });
    const sync = session({ adapter, browser });
    sync.connect();

    const staleDeletion = sync.deleteRecipe();
    sync.updateContext({
      context: {
        locale: "fr",
        mode: "update",
        selectedSlug: "cake-au-citron",
      },
      selectedRecipe: {
        slug: "cake-au-citron",
        revision: 8,
        isPublic: false,
        draft: draft("Cake enregistré"),
      },
    });
    deleteResponse.resolve({
      ok: true,
      status: 200,
      data: {
        type: "success",
        message: "Supprimé",
        slug: "tarte-au-citron",
      },
    });

    await expect(staleDeletion).resolves.toBe(false);
    expect(sync.getSnapshot()).toMatchObject({
      state: { type: "idle" },
      deleted: false,
      revision: 8,
    });
    expect(
      browser.entries.get("recipe-admin-draft:v1:cake-au-citron"),
    ).toBe(cakeRecovery);
  });

  test("adopts a created slug for subsequent saves", async () => {
    const adapter = transport({
      save: vi
        .fn()
        .mockResolvedValueOnce(success(1, "nouvelle-recette"))
        .mockResolvedValueOnce(success(2, "nouvelle-recette")),
    });
    const sync = session({
      adapter,
      mode: "create",
      slug: "",
      revision: 0,
      initialDraft: draft("Nouvelle recette"),
    });

    await sync.save(draft("Nouvelle recette"), true);
    await sync.save(draft("Nouvelle recette mise à jour"));

    expect(vi.mocked(adapter.save).mock.calls[1][0]).toMatchObject({
      mode: "update",
      slug: "nouvelle-recette",
      expectedRevision: 1,
    });
  });
});
