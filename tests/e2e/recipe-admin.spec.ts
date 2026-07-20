import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function mockRecipeApi(page: Page) {
  let revision = 3;
  await page.route("**/api/admin/recipes/**", async (route) => {
    const url = new URL(route.request().url());
    revision += 1;
    if (url.pathname.endsWith("/discard-draft")) {
      return route.fulfill({ json: { type: "success", slug: "tarte-de-demonstration", revision, publishedRevision: revision, savedAt: Date.now(), draft: restoredDraft } });
    }
    if (url.pathname.endsWith("/publish")) {
      return route.fulfill({ json: { type: "success", slug: "tarte-de-demonstration", revision, publishedRevision: revision, savedAt: Date.now() } });
    }
    if (url.pathname.endsWith("/unpublish")) return route.fulfill({ json: { type: "success", slug: "tarte-de-demonstration" } });
    if (url.pathname.endsWith("/unsplash-hero-image")) {
      return route.fulfill({ json: {
        type: "success",
        slug: "tarte-de-demonstration",
        revision,
        savedAt: Date.now(),
        heroImageUrl: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea",
        imageCredit: {
          provider: "unsplash",
          photographerName: "Photographe test",
          photographerUrl: "https://example.com/photographe",
          photoUrl: "https://example.com/photo",
          alt: "Dessert de démonstration",
        },
      } });
    }
    return route.fulfill({ json: { type: "success", message: "Enregistré", slug: "tarte-de-demonstration", revision, savedAt: Date.now() } });
  });
}

async function mockImageSearchApi(page: Page) {
  await page.route("**/api/admin/unsplash/search**", (route) => route.fulfill({
    json: {
      results: [{
        id: "unsplash-test",
        imageUrl: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea",
        previewUrl: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400",
        alt: "Dessert de démonstration",
        photographerName: "Photographe test",
        photographerUrl: "https://example.com/photographe",
        photoUrl: "https://example.com/photo",
        downloadLocation: "https://example.com/download",
      }],
    },
  }));
  await page.route("**/api/admin/openverse/search**", (route) => route.fulfill({ json: { results: [] } }));
}

const localized = {
  title: "Tarte de démonstration", author: "Maman", description: "Une recette restaurée.",
  yieldLabel: "6 personnes", prepTime: "20 min", cookTime: "30 min", totalTime: "50 min", timeLabel: "50 min", temperature: "180 °C",
  ingredients: [{ name: "Farine", quantity: "200", unit: "g", notes: "" }], sections: [{ title: "Préparation", steps: ["Mélanger."] }], subRecipes: [], notes: [],
};
const restoredDraft = { defaultLocale: "fr", translations: { fr: localized, en: { ...localized, title: "Demo tart", yieldLabel: "6 servings" } }, categories: ["dessert"] };

test.beforeEach(async ({ page }) => {
  await mockRecipeApi(page);
  await page.goto("/fr/admin/recettes");
  await expect(page.locator("form[data-recipe-admin-hydrated=true]")).toBeAttached();
});

test("recipe home is usable and accessible at every supported width", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { name: /Recettes|Le carnet/ })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Rechercher une recette" }),
  ).toBeVisible();
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  const minimum = testInfo.project.name.startsWith("mobile-") ? 44 : 40;
  for (const button of await page.locator("main button").all()) {
    if (!(await button.isVisible())) continue;
    const box = await button.boundingBox();
    if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(minimum);
  }
});

test("admin home links back to the public cookbook", async ({ page }) => {
  const publicLink = page.getByRole("link", { name: "Site public" });
  await expect(publicLink).toHaveAttribute("href", "/fr");
  await publicLink.click();
  await expect(page).toHaveURL(/\/fr$/);
});

test("editor action dock stays compact at every supported width", async ({ page }) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();

  const dock = page.getByRole("navigation", { name: "Actions de la recette" });
  const actions = dock.getByRole("button");
  await expect(actions).toHaveCount(3);

  for (const action of await actions.all()) {
    const box = await action.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeLessThanOrEqual(52);
  }

  await expect(dock.getByRole("button", { name: /Publier, recette prête|Publier, \d+ éléments obligatoires/ })).toBeVisible();
});

test("legacy photo and essentials links normalize to the combined workspace", async ({ page }) => {
  for (const legacySection of ["photo", "essentials"]) {
    await page.goto(`/fr/admin/recettes?slug=tarte-de-demonstration&section=${legacySection}`);
    await expect(page).toHaveURL(/section=info/);
    await expect(page.getByRole("heading", { name: "Image principale" })).toBeVisible();
    await expect(page.getByLabel("Titre")).toBeVisible();
  }
});

test("structurally invalid fields block autosave and revalidate while correcting", async ({ page }) => {
  let saveRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/admin/recipes/save")) saveRequests += 1;
  });
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  const title = page.getByLabel("Titre");
  await title.fill("x".repeat(201));
  await title.blur();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await page.waitForTimeout(900);
  expect(saveRequests).toBe(0);

  const saved = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/save"),
  );
  await title.fill("Titre corrigé");
  await expect(title).toHaveAttribute("aria-invalid", "false");
  await saved;
});

test("server field errors return to the combined workspace", async ({ page }) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.unroute("**/api/admin/recipes/**");
  await page.route("**/api/admin/recipes/save", (route) => route.fulfill({
    status: 400,
    json: {
      type: "validation",
      message: "Corrige les champs indiqués avant d’enregistrer.",
      fieldErrors: {
        "translations.fr.title": "Ce titre est refusé par le serveur.",
      },
    },
  }));

  await page.getByLabel("Titre").fill("Titre envoyé au serveur");
  await expect(page.getByText("Ce titre est refusé par le serveur.")).toBeVisible();
  await expect(page).toHaveURL(/section=info.*field=translations.fr.title/);
});

test("mobile publish action becomes primary when saved changes need publishing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();

  const publishAction = page
    .getByRole("navigation", { name: "Actions de la recette" })
    .getByRole("button", { name: /Publier,/ });
  await expect(publishAction).not.toHaveAttribute("data-publication-needed");
  await expect(publishAction).not.toHaveClass(/\bbg-primary\b/);

  await expect(page).toHaveURL(/section=info/);
  const saveRequest = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/save"),
  );
  await page.getByLabel("Description").fill("Une modification prête à être publiée.");
  await saveRequest;
  await expect(page.getByText("Enregistré")).toBeVisible();

  await expect(publishAction).toHaveAttribute("data-publication-needed", "true");
  await expect(publishAction).toHaveClass(/\bbg-primary\b/);
  await expect(publishAction).toHaveClass(/\btext-primary-foreground\b/);
});

test("editor toolbar keeps context and language controls together", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();

  const toolbar = page.locator("main header:visible");
  const language = toolbar.getByRole("group", { name: "Langue du contenu" });
  await expect(language.getByRole("button", { name: "Français" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Contenu édité", { exact: true })).toHaveCount(0);

  const box = await toolbar.boundingBox();
  const maximumHeight = testInfo.project.name.startsWith("mobile-") ? 124 : 72;
  expect(box?.height).toBeLessThanOrEqual(maximumHeight);
});

test("guided editor opens an isolated draft preview", async ({ page }) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("button", { name: "Prévisualiser le brouillon" }).click();
  await expect(page).toHaveURL(/mode=preview/);
  await expect(page.getByText("Aperçu du brouillon")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Tarte de démonstration" })).toBeVisible();
  const frenchYield = page.locator("span:visible").filter({ hasText: /^6 personnes$/ }).first();
  await expect(frenchYield).toBeVisible();
  await expect(frenchYield).toHaveCSS("text-transform", "none");
  await expect(page.getByRole("link", { name: /cuisiner/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Anglais" }).click();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page.getByRole("heading", { level: 1, name: "Demo tart" })).toBeVisible();
  await expect(page.locator("span:visible").filter({ hasText: /^6 servings$/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Détails" }).click();
  await expect(page).not.toHaveURL(/mode=preview/);
  await expect(page).toHaveURL(/section=details/);
  await expect(page).toHaveURL(/lang=en/);
  await expect(page.getByLabel("Préparation")).toBeVisible();
});

test("yield is edited as one independent localized field", async ({ page }) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("navigation", { name: "Actions de la recette" }).getByRole("button", { name: "Recette", exact: true }).click();
  await page.getByRole("button", { name: "Détails" }).click();

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

test("desktop internet image search displays its result cards", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await mockImageSearchApi(page);
  await page.route("**/api/admin/unsplash/download", (route) => route.fulfill({ json: { ok: true } }));
  const mutationOrder: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/admin/recipes/save")) mutationOrder.push("save");
    if (request.url().endsWith("/api/admin/recipes/unsplash-hero-image")) mutationOrder.push("image");
  });
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("button", { name: "Remplacer l’image" }).click();
  await page.getByRole("searchbox", { name: "Mots-clés de recherche d'image" }).fill("tarte fraise");
  await page.getByRole("button", { name: "Chercher", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Remplacer l’image principale" });
  const result = dialog.getByRole("button", { name: /Photographe test/ });
  await expect(result).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  const resultBox = await result.boundingBox();
  expect(dialogBox?.height).toBeGreaterThan(400);
  expect(resultBox?.y ?? 0).toBeGreaterThanOrEqual(dialogBox?.y ?? 0);
  expect((resultBox?.y ?? 0) + (resultBox?.height ?? 0)).toBeLessThanOrEqual(
    (dialogBox?.y ?? 0) + (dialogBox?.height ?? 0),
  );
  await page.getByLabel("Titre").fill("Tarte avec nouvelle image");
  await result.click();
  await expect(page.getByRole("main").getByText("Image associée et enregistrée.")).toBeVisible();
  await expect(page.getByRole("region", { name: /Notifications/ }).getByText("Image principale remplacée.")).toBeVisible();
  expect(mutationOrder).toEqual(["save", "image"]);
});

test("malformed image association responses clean up uploaded storage", async ({ page }, testInfo) => {
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

test("semantic typography stays readable at every supported width", async ({ page }, testInfo) => {
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
    "Tarte de démonstration extraordinairement longue avec citron, noisettes et crème anglaise ".repeat(4);
  const titleLayout = await truncatedRecipeTitle.evaluate(
    (element, value) => {
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
    },
    longTitle,
  );
  if (testInfo.project.name.startsWith("mobile-")) {
    expect(titleLayout.clipped).toBe(true);
  }
  expect(titleLayout.overflow).toBe("hidden");
  expect(titleLayout.title).toBe(longTitle);
});

test("mobile workspaces preserve URL state, focus blockers, and autosave", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  await page.getByPlaceholder("Rechercher une recette").fill("démonstration");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await expect(page).toHaveURL(/section=info/);
  const save = page.waitForRequest((request) => request.url().endsWith("/api/admin/recipes/save"));
  await page.getByLabel("Description").fill("Une description autosauvegardée.");
  await save;
  await page.getByRole("button", { name: /Retour à la recette/ }).click();
  await page.getByRole("button", { name: /Vérifier/ }).click();
  await page.getByRole("button", { name: /Ajoute une image principale/ }).click();
  await expect(page).toHaveURL(/section=info.*field=heroImageUrl/);
  await page.goBack();
  await expect(page).toHaveURL(/section=publish/);
});

test("mobile sorting supports keyboard handles and discard restores the approved snapshot", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("navigation", { name: "Actions de la recette" }).getByRole("button", { name: "Recette", exact: true }).click();
  await page.getByRole("button", { name: /Ingrédients/ }).click();
  const handle = page.getByRole("button", { name: /Déplacer 200 g Farine/ });
  await handle.focus();
  await page.keyboard.press("Space", { delay: 100 });
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown", { delay: 100 });
  await page.waitForTimeout(100);
  await page.keyboard.press("Space", { delay: 100 });
  await expect(page.getByText(/déplacé en position 2/)).toBeAttached();
  await page.getByRole("button", { name: /Retour à la recette/ }).click();
  await page.getByRole("button", { name: /Vérifier/ }).click();
  await page.getByRole("button", { name: /Abandonner les modifications/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Abandonner", exact: true }).click();
  await expect(page.getByText("Modifications non publiées")).toHaveCount(0);
});

test("mobile section editor remains usable above the software keyboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("navigation", { name: "Actions de la recette" }).getByRole("button", { name: "Recette", exact: true }).click();
  await page.getByRole("button", { name: /Préparation/ }).click();
  await expect(page).toHaveURL(/section=preparation/);
  await page.getByRole("button", { name: /Préparation.*étapes?/ }).click();

  const drawer = page.locator('[data-slot="drawer-content"]');
  await expect(drawer).toBeVisible();
  const titleInput = drawer.locator("input").first();
  await expect(titleInput).not.toBeFocused();
  await titleInput.focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", { configurable: true, value: 430 });
    window.visualViewport?.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(500);

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
  expect((doneBox?.y ?? 0) + (doneBox?.height ?? 0)).toBeLessThanOrEqual(430);
});

test("mobile creation and every focused workspace remain navigable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Nouvelle/ }).click();
  await expect(page.locator("form[data-recipe-admin-mode=create]")).toBeAttached();
  await page.getByLabel("Titre français").fill("Nouvelle tarte mobile");
  const startRecipe = page.getByRole("button", { name: /Commencer la recette/ });
  await expect(startRecipe).toBeEnabled();
  const creationResponse = page.waitForResponse((response) => {
    if (!response.url().endsWith("/api/admin/recipes/save")) return false;
    return response.request().postData()?.includes("Nouvelle tarte mobile") ?? false;
  });
  await startRecipe.evaluate((button: HTMLButtonElement) => button.click());
  expect((await creationResponse).ok()).toBe(true);
  await expect(page).toHaveURL(/slug=tarte-de-demonstration.*section=info/, { timeout: 10_000 });

  await page.getByRole("button", { name: /Retour à la recette/ }).click();
  for (const section of ["info", "details", "ingredients", "preparation", "notes", "translation", "publish"]) {
    const labels: Record<string, RegExp> = {
      info: /Informations principales/, details: /Détails/, ingredients: /Ingrédients/,
      preparation: /Préparation/, notes: /^Notes/, translation: /Traduction/, publish: /Vérifier/,
    };
    await page.getByRole("button", { name: labels[section] }).first().click();
    await expect(page).toHaveURL(new RegExp(`section=${section}`));
    await page.getByRole("button", { name: /Retour à la recette/ }).click();
  }
});

test("browser back returns to the recipe list", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await expect(page).toHaveURL(/slug=tarte-de-demonstration/);
  await page.goBack();
  await expect(page.getByPlaceholder("Rechercher une recette")).toBeVisible();
});

test("offline recovery and typed conflicts surface in the shared sync UI", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await expect(page).toHaveURL(/section=info/);
  await expect(page.getByLabel("Auteur")).toBeVisible();
  await page.context().setOffline(true);
  await page.getByLabel("Auteur").fill("Autrice hors ligne");
  await expect(page.getByText("Hors ligne")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("recipe-admin-draft:v1:tarte-de-demonstration"))).not.toBeNull();
  await page.context().setOffline(false);
  await expect(page.getByText("Enregistré")).toBeVisible();

  await page.unroute("**/api/admin/recipes/**");
  await page.route("**/api/admin/recipes/save", (route) => route.fulfill({ status: 409, json: { type: "conflict", message: "Ce brouillon a été modifié ailleurs.", latestRevision: 12 } }));
  await page.getByLabel("Description").fill("Déclenche un conflit.");
  await expect(page.getByText("Modifications sur un autre appareil")).toBeVisible();
  await page.unroute("**/api/admin/recipes/save");
  await mockRecipeApi(page);
  await page.getByRole("button", { name: "Remplacer", exact: true }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
});

test("unpublish hides but retains the approved version, then publish restores visibility", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("navigation", { name: "Actions de la recette" }).getByRole("button", { name: /Publier,/ }).click();
  await page.getByRole("button", { name: /Retirer du site public/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retirer du site", exact: true }).click();
  await expect(page.getByText(/version approuvée est actuellement masquée/i)).toBeVisible();
  await page.getByRole("button", { name: /Publier les modifications/ }).click();
  await expect(page.getByText(/version approuvée est visible publiquement/i)).toBeVisible();
});

test("deleting a recipe requires confirmation and returns to the recipe list", async ({ page }) => {
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page
    .getByRole("navigation", { name: "Actions de la recette" })
    .getByRole("button", { name: /Publier,/ })
    .click();

  const deleteButton = page.getByRole("button", { name: "Supprimer la recette" });
  await deleteButton.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: /Supprimer « Tarte de démonstration »/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(deleteButton).toBeFocused();
  await expect(page).toHaveURL(/slug=tarte-de-demonstration/);

  const deletion = page.waitForRequest((request) =>
    request.url().endsWith("/api/admin/recipes/delete"),
  );
  await page.getByRole("button", { name: "Supprimer la recette" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer définitivement" }).click();
  const request = await deletion;
  expect(request.method()).toBe("DELETE");
  expect(request.postDataJSON()).toMatchObject({
    slug: "tarte-de-demonstration",
    expectedRevision: expect.any(Number),
  });
  await expect(page).toHaveURL(/\/fr\/admin\/recettes$/);
  await expect(page.getByPlaceholder("Rechercher une recette")).toBeVisible();
});
