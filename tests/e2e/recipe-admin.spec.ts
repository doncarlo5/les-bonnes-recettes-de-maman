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
    return route.fulfill({ json: { type: "success", message: "Enregistré", slug: "tarte-de-demonstration", revision, savedAt: Date.now() } });
  });
}

const localized = {
  title: "Tarte de démonstration", author: "Maman", description: "Une recette restaurée.",
  servings: { quantity: 6, unit: "personnes" }, prepTime: "20 min", cookTime: "30 min", totalTime: "50 min", timeLabel: "50 min", temperature: "180 °C",
  ingredients: [{ name: "Farine", quantity: "200", unit: "g", notes: "" }], sections: [{ title: "Préparation", steps: ["Mélanger."] }], subRecipes: [], notes: [],
};
const restoredDraft = { defaultLocale: "fr", translations: { fr: localized, en: { ...localized, title: "Demo tart" } }, tags: ["dessert"], status: "published" };

test.beforeEach(async ({ page }) => {
  await mockRecipeApi(page);
  await page.goto("/fr/admin/recettes");
});

test("recipe home is usable and accessible at every supported width", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { name: /Recettes|Le carnet/ })).toBeVisible();
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  const minimum = testInfo.project.name.startsWith("mobile-") ? 44 : 40;
  for (const button of await page.locator("main button").all()) {
    if (!(await button.isVisible())) continue;
    const box = await button.boundingBox();
    if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(minimum);
  }
});

test("semantic typography stays readable at every supported width", async ({ page }, testInfo) => {
  const rootTypography = await page.locator("html").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontFamily: style.fontFamily,
      fontSynthesis: style.fontSynthesis,
    };
  });
  expect(rootTypography.fontFamily).toContain("Nunito Sans");
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
  expect(pageTitleStyle.fontFamily).toContain("Playfair Display");
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
    expect(controlStyle.fontFamily).toContain("Nunito Sans");
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
    expect(headingStyle.fontFamily).toContain("Nunito Sans");
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
  await page.getByRole("button", { name: /L’essentiel/ }).click();
  await expect(page).toHaveURL(/section=essentials.*lang=fr/);
  const save = page.waitForRequest((request) => request.url().endsWith("/api/admin/recipes/save"));
  await page.getByLabel("Description").fill("Une description autosauvegardée.");
  await save;
  await page.getByRole("button", { name: /Retour à la recette/ }).click();
  await page.getByRole("button", { name: /Vérifier/ }).click();
  await page.getByRole("button", { name: /Ajoute une image principale/ }).click();
  await expect(page).toHaveURL(/section=photo.*field=heroImageUrl/);
  await page.goBack();
  await expect(page).toHaveURL(/section=publish/);
});

test("mobile sorting supports keyboard handles and discard restores the approved snapshot", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
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
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Abandonner les modifications/ }).click();
  await expect(page.getByText("Modifications non publiées")).toHaveCount(0);
});

test("mobile creation and every focused workspace remain navigable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Nouvelle/ }).click();
  await page.getByLabel("Titre français").fill("Nouvelle tarte mobile");
  const startRecipe = page.getByRole("button", { name: /Commencer la recette/ });
  await expect(startRecipe).toBeEnabled();
  const creationResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/admin/recipes/save"),
  );
  await startRecipe.evaluate((button: HTMLButtonElement) => button.click());
  expect((await creationResponse).ok()).toBe(true);
  await expect(page).toHaveURL(/slug=tarte-de-demonstration/, { timeout: 10_000 });

  for (const section of ["essentials", "photo", "details", "ingredients", "preparation", "notes", "translation", "publish"]) {
    const labels: Record<string, RegExp> = {
      essentials: /L’essentiel/, photo: /^Photo/, details: /Détails/, ingredients: /Ingrédients/,
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
  await page.getByRole("button", { name: /L’essentiel/ }).click();
  await expect(page).toHaveURL(/section=essentials/);
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
  await page.getByRole("button", { name: "Remplacer" }).click();
  await expect(page.getByText("Enregistré")).toBeVisible();
});

test("unpublish hides but retains the approved version, then publish restores visibility", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390");
  await page.getByRole("button", { name: /Tarte de démonstration/ }).click();
  await page.getByRole("button", { name: /Vérifier/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Retirer du site public/ }).click();
  await expect(page.getByText(/version approuvée est actuellement masquée/i)).toBeVisible();
  await page.getByRole("button", { name: /Publier les modifications/ }).click();
  await expect(page.getByText(/version approuvée est visible publiquement/i)).toBeVisible();
});
