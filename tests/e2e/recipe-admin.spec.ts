import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function setVisualViewport(
  page: Page,
  { height, offsetTop }: { height: number; offsetTop: number },
) {
  await page.evaluate(
    ({ nextHeight, nextOffsetTop }) => {
      Object.defineProperty(window.visualViewport, "height", {
        configurable: true,
        value: nextHeight,
      });
      Object.defineProperty(window.visualViewport, "offsetTop", {
        configurable: true,
        value: nextOffsetTop,
      });
      window.visualViewport?.dispatchEvent(new Event("resize"));
      window.visualViewport?.dispatchEvent(new Event("scroll"));
    },
    { nextHeight: height, nextOffsetTop: offsetTop },
  );
  await page.waitForTimeout(500);
}

async function mockRecipeApi(page: Page) {
  let revision = 3;
  await page.route("**/api/admin/recipes/**", async (route) => {
    const url = new URL(route.request().url());
    revision += 1;
    if (url.pathname.endsWith("/discard-draft")) {
      return route.fulfill({
        json: {
          type: "success",
          slug: "tarte-de-demonstration",
          revision,
          publishedRevision: revision,
          savedAt: Date.now(),
          heroImageUrl: "/images/published-recipe.jpg",
          draft: restoredDraft,
        },
      });
    }
    if (url.pathname.endsWith("/publish")) {
      return route.fulfill({
        json: {
          type: "success",
          slug: "tarte-de-demonstration",
          revision,
          publishedRevision: revision,
          savedAt: Date.now(),
        },
      });
    }
    if (url.pathname.endsWith("/visibility"))
      return route.fulfill({
        json: { type: "success", slug: "tarte-de-demonstration", isPublic: false },
      });
    if (url.pathname.endsWith("/unsplash-hero-image")) {
      return route.fulfill({
        json: {
          type: "success",
          slug: "tarte-de-demonstration",
          revision,
          savedAt: Date.now(),
          heroImageUrl:
            "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea",
          imageCredit: {
            provider: "unsplash",
            photographerName: "Photographe test",
            photographerUrl: "https://example.com/photographe",
            photoUrl: "https://example.com/photo",
            alt: "Dessert de démonstration",
          },
        },
      });
    }
    return route.fulfill({
      json: {
        type: "success",
        message: "Enregistré",
        slug: "tarte-de-demonstration",
        revision,
        savedAt: Date.now(),
      },
    });
  });
}

async function mockImageSearchApi(page: Page) {
  await page.route("**/api/admin/unsplash/search**", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: "unsplash-test",
            imageUrl:
              "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea",
            previewUrl:
              "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400",
            alt: "Dessert de démonstration",
            photographerName: "Photographe test",
            photographerUrl: "https://example.com/photographe",
            photoUrl: "https://example.com/photo",
            downloadLocation: "https://example.com/download",
          },
        ],
      },
    }),
  );
  await page.route("**/api/admin/openverse/search**", (route) =>
    route.fulfill({ json: { results: [] } }),
  );
}

const localized = {
  title: "Tarte de démonstration",
  author: "Maman",
  description: "Une recette restaurée.",
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
      id: "ingredient-restored",
      name: "Farine",
      quantity: "200",
      unit: "g",
      notes: "",
    },
  ],
  sections: [
    {
      title: "Préparation",
      steps: [
        {
          id: "step-restored",
          text: "Mélanger.",
          ingredientUses: [{ ingredientId: "ingredient-restored" }],
        },
      ],
    },
  ],
  subRecipes: [],
  notes: [],
};
const restoredDraft = {
  defaultLocale: "fr",
  referenceServings: 6,
  relatedRecipeSlugs: [],
  translations: {
    fr: localized,
    en: { ...localized, title: "Demo tart", yieldLabel: "6 servings" },
  },
  categories: ["dessert"],
  legacyCategoryLabels: [],
};

test.beforeEach(async ({ page }) => {
  await mockRecipeApi(page);
  await page.goto("/fr/admin/recettes");
  await expect(
    page.locator("form[data-recipe-admin-hydrated=true]"),
  ).toBeAttached();
});

test("recipe home is usable and accessible at every supported width", async ({
  page,
}, testInfo) => {
  await expect(
    page.getByRole("heading", { name: /Recettes|Le carnet/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Rechercher une recette" }),
  ).toBeVisible();
  const violations = await new AxeBuilder({ page }).analyze();
  expect(
    violations.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
  const minimum = testInfo.project.name.startsWith("mobile-") ? 44 : 40;
  for (const button of await page.locator("main button").all()) {
    if (!(await button.isVisible())) continue;
    const box = await button.boundingBox();
    if (box)
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(minimum);
  }
});

test("admin home links back to the public cookbook", async ({ page }) => {
  const publicLink = page.getByRole("link", { name: "Site public" });
  await expect(publicLink).toHaveAttribute("href", "/fr");
  await publicLink.click();
  await expect(page).toHaveURL(/\/fr$/);
});

test("admin creation chooser and idea conversion preserve the private source context", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Nouvelle" }).click();
  const chooser = page.getByRole("dialog");
  await expect(
    chooser.getByRole("link", { name: /Écrire la recette complète/ }),
  ).toHaveAttribute("href", "/fr/admin/recettes?new=1");
  await expect(
    chooser.getByRole("link", { name: /Laisser une idée/ }),
  ).toHaveAttribute("href", "/fr/admin/recettes?view=ideas&newIdea=1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Nouvelle" })).toBeFocused();

  const ideas = [
    {
      _id: "e2e-recipe-idea",
      _creationTime: 1,
      text: "La tarte aux mirabelles de mamie",
      authorName: "Jeanne",
      state: "outstanding",
      updatedAt: 1,
      edited: false,
      creatorKind: "participant",
      canEdit: false,
      canDelete: false,
      linkedRecipe: null,
    },
  ];
  const completedIdeas = [
    {
      ...ideas[0],
      _id: "e2e-completed-idea",
      text: "Le gâteau déjà publié",
      state: "completed",
      linkedRecipe: {
        slug: "tarte-de-demonstration",
        title: "Tarte de démonstration",
        isPublic: true,
      },
    },
  ];
  let createdFromCompleted = false;
  await page.route("**/api/admin/recipe-ideas**", async (route) => {
    if (route.request().method() === "POST") {
      createdFromCompleted = true;
      ideas.unshift({
        ...ideas[0],
        _id: "e2e-admin-idea",
        text: "Les bugnes du mercredi",
        authorName: "Maman",
        creatorKind: "admin",
      });
      return route.fulfill({ json: { ideaId: "e2e-admin-idea" } });
    }
    const state = new URL(route.request().url()).searchParams.get("state");
    if (state === "completed") {
      if (createdFromCompleted) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return route.fulfill({
        json: { page: completedIdeas, isDone: true, continueCursor: "" },
      });
    }
    return route.fulfill({
      json: { page: ideas, isDone: true, continueCursor: "" },
    });
  });
  await page.goto("/fr/admin/recettes?view=ideas");
  await expect(
    page.getByRole("heading", { name: "Idées de recettes", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ajoutées au carnet" }).click();
  await expect(page.getByText("Le gâteau déjà publié")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter une idée rapide" }).click();
  await page.getByLabel("Votre nom (facultatif)").fill("Maman");
  await page.getByLabel("Votre idée").fill("Les bugnes du mercredi");
  await page.getByRole("button", { name: "Publier l’idée" }).click();
  await expect(page.getByText("Les bugnes du mercredi")).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByText("Le gâteau déjà publié")).toHaveCount(0);

  const sourceCard = page.locator("article").filter({
    hasText: "La tarte aux mirabelles de mamie",
  });
  await sourceCard.getByRole("link", { name: "Créer la recette" }).click();
  await expect(page).toHaveURL(/new=1&idea=e2e-recipe-idea/);
  await expect(
    page.getByText("La tarte aux mirabelles de mamie"),
  ).toBeVisible();
  await expect(page.getByText("Jeanne", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Titre français")).toHaveValue("");
});

test("changes are saved privately after a short pause", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();

  const saveRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/save"),
  );
  await page.getByLabel("Description").fill("Une modification manuelle.");
  await saveRequest;
  await expect(page.getByText("Sauvegardé", { exact: true })).toBeVisible();
});

test("a pending image save survives a reload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await expect(page).toHaveURL(/slug=tarte-de-demonstration/);
  await page.evaluate(() =>
    localStorage.setItem(
      "recipe-admin-pending-image:v1:tarte-de-demonstration",
      "3",
    ),
  );
  await page.reload();

  const saveRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/save"),
  );
  await page.getByRole("button", { name: "Publier les modifications" }).click();
  await saveRequest;
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "recipe-admin-pending-image:v1:tarte-de-demonstration",
      ),
    ),
  ).toBeNull();
});

test("legacy photo and essentials links normalize to the combined workspace", async ({
  page,
}) => {
  for (const legacySection of ["photo", "essentials"]) {
    await page.goto(
      `/fr/admin/recettes?slug=tarte-de-demonstration&section=${legacySection}`,
    );
    await expect(page).not.toHaveURL(/section=/);
    await expect(
      page.getByRole("heading", { name: "Image principale" }),
    ).toBeVisible();
    await expect(page.getByLabel("Titre")).toBeVisible();
  }
});

test("structurally invalid fields block publication and revalidate while correcting", async ({
  page,
}) => {
  let saveRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/admin/recipes/save")) saveRequests += 1;
  });
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  const title = page.getByLabel("Titre");
  await title.fill("x".repeat(201));
  await title.blur();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Publier les modifications" }).click();
  expect(saveRequests).toBe(0);

  const saved = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/save"),
  );
  await title.fill("Titre corrigé");
  await expect(title).toHaveAttribute("aria-invalid", "false");
  await saved;
});

test("server field errors return to the combined workspace", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.unroute("**/api/admin/recipes/**");
  await page.route("**/api/admin/recipes/save", (route) =>
    route.fulfill({
      status: 400,
      json: {
        type: "validation",
        message: "Corrige les champs indiqués avant d’enregistrer.",
        fieldErrors: {
          "translations.fr.title": "Ce titre est refusé par le serveur.",
        },
      },
    }),
  );

  await page.getByLabel("Titre").fill("Titre envoyé au serveur");
  await expect(
    page.getByText("Ce titre est refusé par le serveur."),
  ).toBeVisible();
  await expect(page).toHaveURL(/field=translations.fr.title/);
  await expect(page).not.toHaveURL(/section=/);
});

test("a server error opens the collapsed group that contains its field", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  const complements = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Compléments" }),
  });
  await expect(complements).not.toHaveAttribute("open", "");
  await page.unroute("**/api/admin/recipes/**");
  await page.route("**/api/admin/recipes/save", (route) =>
    route.fulfill({
      status: 400,
      json: {
        type: "validation",
        message: "Corrige les champs indiqués.",
        fieldErrors: {
          "translations.fr.notes.0": "Cette note est refusée.",
        },
      },
    }),
  );

  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/api/admin/recipes/save"),
  );
  await page.getByLabel("Description").fill("Déclenche l’erreur de note.");
  await response;

  await expect(complements).toHaveAttribute("open", "");
  await expect(page).not.toHaveURL(/section=/);
});

test("editor toolbar keeps context and language controls together", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();

  const toolbar = page.locator("main header:visible");
  const language = toolbar.getByRole("group", { name: "Langue du contenu" });
  await expect(
    language.getByRole("button", { name: "Français" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Contenu édité", { exact: true })).toHaveCount(0);

  const box = await toolbar.boundingBox();
  const maximumHeight = testInfo.project.name.startsWith("mobile-") ? 124 : 72;
  expect(box?.height).toBeLessThanOrEqual(maximumHeight);
});

test("guided editor previews the recipe in either language", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  const preview = page.getByRole("button", { name: "Prévisualiser la recette" });
  await expect(preview).toBeVisible();
  await page.getByRole("button", { name: "Anglais" }).click();
  await expect(
    page.getByLabel("Voir la recette publique", { exact: true }),
  ).toHaveAttribute("href", "/en/recettes/tarte-de-demonstration");
  await preview.click();
  await expect(page).toHaveURL(/mode=preview/);
  await expect(page.getByText("Aperçu avant publication")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo tart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comments" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retour à l’édition" }).click();
  await expect(page).not.toHaveURL(/mode=preview/);
  await expect(page.getByRole("group", { name: "Langue du contenu" })).toBeVisible();
});

test("yield is edited as one independent localized field", async ({ page }) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();

  const frenchYield = page.getByLabel("Quantité obtenue");
  await expect(frenchYield).toHaveValue("6 personnes");
  await expect(page.getByLabel("Portions", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Unité", { exact: true })).toHaveCount(0);

  const saveRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/save"),
  );
  await frenchYield.fill("Environ 20 gougères");
  await saveRequest;

  await page.getByRole("button", { name: "Anglais" }).click();
  await expect(page.getByLabel("Quantité obtenue")).toHaveValue("6 servings");
});

test("desktop internet image search displays its result cards", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await mockImageSearchApi(page);
  await page.route("**/api/admin/unsplash/download", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  const mutationOrder: string[] = [];
  const saveBodies: Array<{ expectedRevision?: number; force?: boolean }> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/admin/recipes/save")) {
      mutationOrder.push("save");
      saveBodies.push(
        request.postDataJSON() as {
          expectedRevision?: number;
          force?: boolean;
        },
      );
    }
    if (request.url().endsWith("/api/admin/recipes/unsplash-hero-image"))
      mutationOrder.push("image");
  });
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByLabel("Titre").fill("Tarte avec nouvelle image");
  await page.getByRole("button", { name: "Remplacer l’image" }).click();
  await page
    .getByRole("searchbox", { name: "Mots-clés de recherche d'image" })
    .fill("tarte fraise");
  await page.getByRole("button", { name: "Chercher", exact: true }).click();

  const dialog = page.getByRole("dialog", {
    name: "Remplacer l’image principale",
  });
  const result = dialog.getByRole("button", { name: /Photographe test/ });
  await expect(result).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  const resultBox = await result.boundingBox();
  expect(dialogBox?.height).toBeGreaterThan(400);
  expect(resultBox?.y ?? 0).toBeGreaterThanOrEqual(dialogBox?.y ?? 0);
  expect((resultBox?.y ?? 0) + (resultBox?.height ?? 0)).toBeLessThanOrEqual(
    (dialogBox?.y ?? 0) + (dialogBox?.height ?? 0),
  );
  await result.click();
  await expect(
    page
      .getByRole("main")
      .getByText("Image associée en privé. Publie les modifications quand tout est prêt."),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: /Notifications/ })
      .getByText("Image principale remplacée."),
  ).toBeVisible();
  expect(mutationOrder).toContain("image");
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "recipe-admin-pending-image:v1:tarte-de-demonstration",
      ),
    ),
  ).not.toBeNull();
  const publishRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/publish"),
  );
  await page.getByRole("button", { name: "Publier les modifications" }).click();
  await publishRequest;
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem(
          "recipe-admin-pending-image:v1:tarte-de-demonstration",
        ),
      ),
    )
    .toBeNull();
  expect(mutationOrder).toContain("save");
  expect(saveBodies.at(-1)).toMatchObject({ force: false });

  await page.getByLabel("Titre").fill("Tarte enregistrée une seconde fois");
  await expect.poll(() => saveBodies.length).toBeGreaterThanOrEqual(2);
  expect(saveBodies.at(-1)).toMatchObject({ force: false });
});

test("reverting immediately restores the published image preview", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await mockImageSearchApi(page);
  await page.route("**/api/admin/unsplash/download", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("button", { name: "Remplacer l’image" }).click();
  await page
    .getByRole("searchbox", { name: "Mots-clés de recherche d'image" })
    .fill("tarte fraise");
  await page.getByRole("button", { name: "Chercher", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Remplacer l’image principale" })
    .getByRole("button", { name: /Photographe test/ })
    .click();
  await expect(page.locator('[data-field-target="heroImageUrl"] img')).toHaveAttribute(
    "src",
    /images\.unsplash\.com/,
  );

  const discard = page.waitForResponse((response) =>
    response.url().endsWith("/api/admin/recipes/discard-draft"),
  );
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page
    .getByRole("menuitem", { name: "Revenir à la version publiée" })
    .click();
  await discard;

  await expect(page.locator('[data-field-target="heroImageUrl"] img')).toHaveAttribute(
    "src",
    /published-recipe\.jpg/,
  );
});

test("malformed image association responses clean up uploaded storage", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.unroute("**/api/admin/recipes/**");
  let cleanupRequests = 0;
  const origin = new URL(page.url()).origin;
  await page.route("**/mock-recipe-storage", (route) =>
    route.fulfill({ json: { storageId: "storage-test" } }),
  );
  await page.route("**/api/admin/recipes/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/upload-url")) {
      return route.fulfill({
        json: { type: "success", uploadUrl: `${origin}/mock-recipe-storage` },
      });
    }
    if (pathname.endsWith("/hero-image")) {
      return route.fulfill({
        json: { type: "success", slug: "tarte-de-demonstration" },
      });
    }
    if (pathname.endsWith("/cleanup-image")) {
      cleanupRequests += 1;
      return route.fulfill({
        json: {
          type: "success",
          referenced: false,
          slug: "tarte-de-demonstration",
        },
      });
    }
    return route.fulfill({
      json: {
        type: "success",
        message: "Enregistré",
        slug: "tarte-de-demonstration",
        revision: 4,
        savedAt: Date.now(),
      },
    });
  });

  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("button", { name: "Remplacer l’image" }).click();
  await page.getByLabel("Choisir une image sur cet appareil").setInputFiles({
    name: "photo.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("test-image"),
  });

  await expect(
    page.getByText("La réponse d’image ne contient pas de révision.").first(),
  ).toBeVisible();
  expect(cleanupRequests).toBe(1);
});

test("semantic typography stays readable at every supported width", async ({
  page,
}, testInfo) => {
  const rootTypography = await page.locator("html").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontFamily: style.fontFamily,
      fontSynthesis: style.fontSynthesis,
    };
  });
  expect(rootTypography.fontFamily).toContain("Source Sans 3");
  expect(rootTypography.fontSynthesis).toBe("none");

  const visiblePageTitles = page.locator("main h1:visible");
  await expect(visiblePageTitles).toHaveCount(1);
  const pageTitleStyle = await visiblePageTitles.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontFamily: style.fontFamily,
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
  expect(pageTitleStyle.fontFamily).toContain("Newsreader");
  expect(pageTitleStyle.fontSize).toBeGreaterThanOrEqual(40);
  expect(pageTitleStyle.lineHeight).toBeGreaterThan(pageTitleStyle.fontSize);

  const editableControl = page
    .locator('main :is(input,textarea,[data-slot="select-trigger"]):visible')
    .first();
  const editableControlCount = await editableControl.count();
  if (testInfo.project.name.startsWith("mobile-")) {
    expect(editableControlCount).toBeGreaterThan(0);
  }
  if (editableControlCount > 0) {
    const controlStyle = await editableControl.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
      };
    });
    expect(controlStyle.fontFamily).toContain("Source Sans 3");
    expect(controlStyle.fontSize).toBeGreaterThanOrEqual(
      testInfo.project.name.startsWith("mobile-") ? 16 : 14,
    );
  }

  const visibleSemanticText = page.locator(
    'main :is([class~="type-label"],[class~="type-meta"]):visible',
  );
  for (const element of await visibleSemanticText.all()) {
    const fontSize = await element.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(12);
  }

  const taskHeadings = page.locator("main :is(h2,h3,h4):visible");
  for (const heading of await taskHeadings.all()) {
    const headingStyle = await heading.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
      };
    });
    expect(headingStyle.fontFamily).toContain("Source Sans 3");
    expect(headingStyle.fontSize).toBeLessThan(pageTitleStyle.fontSize);
  }

  const roleStyles = await page.evaluate(() => {
    const lead = document.createElement("p");
    lead.className = "type-editorial-lead";
    lead.textContent = "Un texte éditorial de contrôle";
    const meta = document.createElement("span");
    meta.className = "type-meta";
    meta.textContent = "123";
    document.body.append(lead, meta);
    const leadStyle = getComputedStyle(lead);
    const metaStyle = getComputedStyle(meta);
    const styles = {
      leadMaxWidth: Number.parseFloat(leadStyle.maxWidth),
      leadOverflowWrap: leadStyle.overflowWrap,
      leadTextWrap: leadStyle.textWrap,
      metaNumeric: metaStyle.fontVariantNumeric,
    };
    lead.remove();
    meta.remove();
    return styles;
  });
  expect(roleStyles.leadMaxWidth).toBeGreaterThan(0);
  expect(roleStyles.leadOverflowWrap).toBe("break-word");
  expect(roleStyles.leadTextWrap).toBe("pretty");
  expect(roleStyles.metaNumeric).toContain("tabular-nums");

  const truncatedRecipeTitle = page
    .locator('[title="Tarte de démonstration"]:visible')
    .first();
  await expect(truncatedRecipeTitle).toHaveCount(1);
  const longTitle =
    "Tarte de démonstration extraordinairement longue avec citron, noisettes et crème anglaise ".repeat(
      4,
    );
  const titleLayout = await truncatedRecipeTitle.evaluate((element, value) => {
    element.textContent = value;
    element.setAttribute("title", value);
    const style = getComputedStyle(element);
    return {
      clipped:
        element.scrollWidth > element.clientWidth ||
        element.scrollHeight > element.clientHeight,
      overflow: style.overflow,
      title: element.getAttribute("title"),
    };
  }, longTitle);
  if (testInfo.project.name.startsWith("mobile-")) {
    expect(titleLayout.clipped).toBe(true);
  }
  expect(titleLayout.overflow).toBe("hidden");
  expect(titleLayout.title).toBe(longTitle);
});

test("mobile workspace keeps the whole recipe on one autosaved page", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  await page.getByPlaceholder("Rechercher une recette").fill("démonstration");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  let saveRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/admin/recipes/save")) saveRequests += 1;
  });
  const saveRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/save"),
  );
  await page.getByLabel("Description").fill("Une description à enregistrer.");
  await expect(page.getByLabel("Quantité obtenue")).toBeVisible();
  await expect(page.locator("summary").filter({ hasText: "Compléments" })).toBeVisible();
  await saveRequest;
  await expect(page.getByLabel("Description")).toHaveValue(
    "Une description à enregistrer.",
  );
  expect(saveRequests).toBe(1);
});

test("mobile sorting supports keyboard handles and autosaving", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  const saved = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/save"),
  );
  const handle = page.getByRole("button", { name: /Déplacer 200 g Farine/ });
  await handle.focus();
  await page.keyboard.press("Space", { delay: 100 });
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown", { delay: 100 });
  await page.waitForTimeout(100);
  await page.keyboard.press("Space", { delay: 100 });
  await expect(page.getByText(/déplacé en position 2/)).toBeAttached();
  await saved;
  expect(pageErrors).toEqual([]);
});

test("mobile section editor remains usable above the software keyboard", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page
    .getByRole("button", { name: /^Préparation \d+ étapes?$/ })
    .click();

  const drawer = page.locator('[data-slot="drawer-content"]');
  await expect(drawer).toBeVisible();
  const titleInput = drawer.locator("input").first();
  await expect(titleInput).not.toBeFocused();
  await titleInput.focus();
  await setVisualViewport(page, { height: 430, offsetTop: 40 });

  const done = drawer.getByRole("button", { name: "Terminé" }).last();
  await expect(titleInput).toBeVisible();
  await expect(done).toBeVisible();

  const [drawerBox, inputBox, doneBox] = await Promise.all([
    drawer.boundingBox(),
    titleInput.boundingBox(),
    done.boundingBox(),
  ]);
  expect(drawerBox?.y).toBeGreaterThanOrEqual(0);
  expect(inputBox?.y).toBeGreaterThanOrEqual(drawerBox?.y ?? 0);
  expect(drawerBox?.y).toBeGreaterThanOrEqual(40);
  expect((doneBox?.y ?? 0) + (doneBox?.height ?? 0)).toBeLessThanOrEqual(470);
  expect(doneBox?.height).toBeGreaterThanOrEqual(44);
});

test("mobile editor keeps publication and language controls available while typing", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();

  const publish = page.getByRole("button", {
    name: "Publier les modifications",
  });
  const language = page.getByRole("group", { name: "Langue du contenu" });
  const title = page.getByLabel("Titre");
  await expect(publish).toBeVisible();
  await expect(language).toBeVisible();

  await title.fill("Titre modifié sur mobile");
  await expect(publish).toBeVisible();
  await expect(language).toBeVisible();
});

test("mobile step editing shows one compact action bar above the keyboard", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page
    .getByRole("button", { name: /^Préparation \d+ étapes?$/ })
    .click();

  const drawer = page.locator('[data-slot="drawer-content"]');
  await drawer.locator("[data-sortable-open]").first().click();
  const stepEditor = drawer.locator("[data-drawer-scroll-target]");
  const textarea = stepEditor.locator("textarea");
  await expect(textarea).toBeFocused();
  await expect(
    drawer.getByRole("button", { name: "Terminé" }).filter({ visible: true }),
  ).toHaveCount(1);
  await expect(
    drawer.getByRole("button", { name: "Supprimer cette étape" }),
  ).toHaveCount(1);
  await expect(
    drawer.getByRole("button", { name: "Supprimer la section" }),
  ).toBeHidden();

  await setVisualViewport(page, { height: 430, offsetTop: 40 });

  const doneBox = await drawer
    .getByRole("button", { name: "Terminé" })
    .boundingBox();
  expect((doneBox?.y ?? 0) + (doneBox?.height ?? 0)).toBeLessThanOrEqual(470);
  expect(doneBox?.height).toBeGreaterThanOrEqual(44);
});

test("an editor can associate main and sub-recipe ingredients with a step", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("button", { name: /^Préparation \d+ étapes?$/ }).click();

  const drawer = page.locator('[data-slot="drawer-content"]');
  await drawer.locator("[data-sortable-open]").first().click();
  await expect(drawer.getByText("Ingrédients de cette étape")).toBeVisible();
  await expect(drawer.getByRole("checkbox", { name: /Farine/ })).toBeChecked();
  const milk = drawer.getByRole("checkbox", { name: /Lait/ });
  await milk.check();
  await expect(milk).toBeChecked();
  await expect(drawer.getByText("Quantité pour l’étape").last()).toBeVisible();
  const stepQuantity = drawer.getByRole("textbox", {
    name: "Quantité pour l’étape – Lait",
  });
  await stepQuantity.fill("la moitié");
  await expect(stepQuantity).toHaveValue("la moitié");
});

test("mobile creation and every focused workspace remain navigable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Nouvelle/ }).click();
  await page.getByRole("link", { name: /Écrire la recette complète/ }).click();
  await expect(
    page.locator("form[data-recipe-admin-mode=create]"),
  ).toBeAttached();
  await page.getByLabel("Titre français").fill("Nouvelle tarte mobile");
  const startRecipe = page.getByRole("button", {
    name: /Commencer la recette/,
  });
  await expect(startRecipe).toBeEnabled();
  const creationResponse = page.waitForResponse((response) => {
    if (!response.url().endsWith("/api/admin/recipes/save")) return false;
    return (
      response.request().postData()?.includes("Nouvelle tarte mobile") ?? false
    );
  });
  await startRecipe.evaluate((button: HTMLButtonElement) => button.click());
  expect((await creationResponse).ok()).toBe(true);
  await expect(page).toHaveURL(/slug=tarte-de-demonstration/, {
    timeout: 10_000,
  });

  await expect(page.locator("summary").filter({ hasText: "Essentiel" })).toBeVisible();
  await expect(page.locator("summary").filter({ hasText: "Recette" })).toBeVisible();
  await expect(page.locator("summary").filter({ hasText: "Compléments" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publier les modifications" })).toBeVisible();
});

test("browser back returns to the recipe list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await expect(page).toHaveURL(/slug=tarte-de-demonstration/);
  await page.goBack();
  await expect(page.getByPlaceholder("Rechercher une recette")).toBeVisible();
});

test("offline recovery and typed conflicts surface in the shared sync UI", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await expect(page.getByLabel("Auteur")).toBeVisible();
  await page.context().setOffline(true);
  await page.getByLabel("Auteur").fill("Autrice hors ligne");
  await expect(page.getByText("Hors ligne")).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("recipe-admin-draft:v1:tarte-de-demonstration"),
    ),
  ).not.toBeNull();
  await page.context().setOffline(false);
  await expect(page.getByText("Sauvegardé")).toBeVisible();

  await page.unroute("**/api/admin/recipes/**");
  await page.route("**/api/admin/recipes/save", (route) =>
    route.fulfill({
      status: 409,
      json: {
        type: "conflict",
        message: "Cette recette a été modifiée ailleurs.",
        latestRevision: 12,
      },
    }),
  );
  await page.getByLabel("Description").fill("Déclenche un conflit.");
  await expect(
    page.getByText("Modifications sur un autre appareil"),
  ).toBeVisible();
  await page.unroute("**/api/admin/recipes/save");
  await mockRecipeApi(page);
  await page.getByRole("button", { name: "Publier quand même", exact: true }).click();
  await expect(page.getByText("Sauvegardé")).toBeVisible();
});

test("deleting a recipe requires confirmation and returns to the recipe list", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();

  const actionsButton = page.getByRole("button", { name: "Autres actions" });
  await actionsButton.click();
  const deleteButton = page.getByRole("menuitem", {
    name: "Supprimer la recette",
  });
  await deleteButton.click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("heading", {
      name: /Supprimer « Tarte de démonstration »/,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(actionsButton).toBeFocused();
  await expect(page).toHaveURL(/slug=tarte-de-demonstration/);

  const deletion = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/delete"),
  );
  await actionsButton.click();
  await page.getByRole("menuitem", { name: "Supprimer la recette" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  const request = await deletion;
  expect(request.method()).toBe("DELETE");
  expect(request.postDataJSON()).toMatchObject({
    slug: "tarte-de-demonstration",
    expectedRevision: expect.any(Number),
  });
  await expect(page).toHaveURL(/\/fr\/admin\/recettes$/);
  await expect(page.getByPlaceholder("Rechercher une recette")).toBeVisible();
});
