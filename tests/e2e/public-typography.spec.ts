import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const longTitles = {
  fr: "Une très longue collection de recettes familiales au citron, aux noisettes et à la crème anglaise",
  en: "A very long collection of family recipes with lemon, hazelnuts, and homemade vanilla custard",
} as const;

test("public typography holds across locales, themes, and widths", async ({ page, request }, testInfo) => {
  for (const locale of ["fr", "en"] as const) {
    await page.goto(`/${locale}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);

    const pageTitles = page.locator("main h1:visible");
    await expect(pageTitles).toHaveCount(1);
    const pageTitle = pageTitles.first();
    const titleStyle = await pageTitle.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontSize: Number.parseFloat(style.fontSize),
      };
    });
    expect(titleStyle.fontFamily).toContain("Newsreader");
    expect(titleStyle.fontSize).toBeGreaterThanOrEqual(40);
    await expectDescendingOutline(page);

    const titleLayout = await pageTitle.evaluate((element, value) => {
      element.textContent = value;
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    }, longTitles[locale]);
    expect(titleLayout.scrollWidth).toBeLessThanOrEqual(titleLayout.clientWidth + 1);
    expect(titleLayout.documentWidth).toBeLessThanOrEqual(titleLayout.viewportWidth + 1);

    const editorialLead = page.locator("main .type-editorial-lead:visible").first();
    if ((await editorialLead.count()) > 0) {
      const measure = await editorialLead.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          maxWidth: Number.parseFloat(style.maxWidth),
          width: element.getBoundingClientRect().width,
          overflowWrap: style.overflowWrap,
          textWrap: style.textWrap,
        };
      });
      expect(measure.maxWidth).toBeGreaterThan(0);
      expect(measure.width).toBeLessThanOrEqual(measure.maxWidth + 1);
      expect(measure.overflowWrap).toBe("break-word");
      expect(measure.textWrap).toBe("pretty");
    }
  }

  const fontResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => /\.(?:woff2?|ttf)(?:\?|$)/.test(url)),
  );
  expect(fontResources.length).toBeGreaterThan(0);
  for (const fontUrl of fontResources) {
    expect(new URL(fontUrl).origin).toBe(new URL(page.url()).origin);
    expect(fontUrl).not.toContain("fonts.googleapis.com");
    expect(fontUrl).not.toContain("fonts.gstatic.com");
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("html").evaluate((element) => element.classList.add("dark"));
  await page.waitForTimeout(50);
  const darkViolations = await new AxeBuilder({ page }).analyze();
  expect(
    darkViolations.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  await page.goto("/fr/recettes");
  await expectDescendingOutline(page);
  const recipeLink = page.locator('main a[href^="/fr/recettes/"]').first();
  if ((await recipeLink.count()) > 0) {
    await recipeLink.click();
    const recipeTitle = page.locator("main h1");
    await expect(recipeTitle).toHaveClass(/type-display/);
    await expectDescendingOutline(page);
    const instructionColumn = page.locator("main ol").first();
    if ((await instructionColumn.count()) > 0 && testInfo.project.name === "desktop") {
      expect((await instructionColumn.boundingBox())?.width ?? 0).toBeLessThanOrEqual(720);
    }
    if (testInfo.project.name === "desktop") {
      const recipeOgUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(recipeOgUrl).toBeTruthy();
      const recipeOgResponse = await request.get(recipeOgUrl!);
      expect(recipeOgResponse.ok()).toBe(true);
      expect(recipeOgResponse.headers()["content-type"]).toContain("image/png");
    }
  }

  const notFoundResponse = await page.goto("/fr/recette-introuvable-typographie");
  expect(notFoundResponse?.status()).toBe(404);
  await expect(page.locator("main h1")).toHaveClass(/type-page-title/);
  await expectDescendingOutline(page);

  if (testInfo.project.name === "desktop") {
    const ogResponse = await request.get("/fr/opengraph-image");
    expect(ogResponse.ok()).toBe(true);
    expect(ogResponse.headers()["content-type"]).toContain("image/png");
  }
});

test("mobile recipe cards keep an equal-height structure and show prep time", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  await page.goto("/fr");

  const recipeLink = page.locator('main a[href^="/fr/recettes/"]').first();
  await expect(recipeLink.getByLabel("Préparation: 20 min")).toBeVisible();

  const layout = await recipeLink.evaluate((link) => {
    const card = link.closest("li");
    const title = link.querySelector(".type-card-title");
    return {
      cardHeight: card?.getBoundingClientRect().height ?? 0,
      linkHeight: link.getBoundingClientRect().height,
      titleHeight: title?.getBoundingClientRect().height ?? 0,
      titleLineHeight: title ? Number.parseFloat(getComputedStyle(title).lineHeight) : 0,
    };
  });

  expect(layout.linkHeight).toBeCloseTo(layout.cardHeight, 0);
  expect(layout.titleHeight).toBeGreaterThanOrEqual(layout.titleLineHeight * 2 - 1);
});

test("mobile recipe cards fall back to cooking time", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  await page.goto("/en");

  const recipeLink = page.locator('main a[href^="/en/recettes/"]').first();
  await expect(recipeLink.getByLabel("Cook: 30 min")).toBeVisible();
  await expect(recipeLink.getByText(/Prep ·/)).toHaveCount(0);
});

test("mobile cookbook exposes an aligned create shortcut beside search", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  await page.goto("/fr");

  const createLink = page.getByRole("link", { name: "Ajouter une recette" });
  const searchButton = page.getByRole("button", { name: "Rechercher une recette" });
  await expect(createLink).toHaveAttribute("href", "/fr/admin/recettes?new=1");

  const createBox = await createLink.boundingBox();
  const searchBox = await searchButton.boundingBox();
  expect(createBox?.width).toBe(44);
  expect(createBox?.height).toBe(44);
  expect(searchBox?.y).toBeCloseTo(createBox?.y ?? 0, 0);
  expect((searchBox?.x ?? 0) - ((createBox?.x ?? 0) + (createBox?.width ?? 0))).toBe(8);
});

test("public recipe photos do not display source credits", async ({ page }) => {
  await page.goto("/fr/recettes/tarte-de-demonstration");

  await expect(page.getByRole("img", { name: "Tarte de démonstration décorée de fruits" })).toBeVisible();
  await expect(page.getByText("Photographe de démonstration", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Unsplash" })).toHaveCount(0);
});

test("desktop recipe body aligns preparation with a compact ingredient panel", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.goto("/fr/recettes/tarte-de-demonstration");

  const preparation = page.getByRole("heading", { name: "Préparation" });
  const ingredients = page.getByRole("heading", { name: "Ingrédients" });
  const ingredientPanel = ingredients.locator("xpath=ancestor::aside");
  const preparationBox = await preparation.boundingBox();
  const panelBox = await ingredientPanel.boundingBox();
  expect(panelBox?.y).toBeCloseTo(preparationBox?.y ?? 0, 0);

  const temperature = page.getByText("four moyen", { exact: true });
  await expect(page.getByText("Température", { exact: true })).toBeVisible();
  const temperatureLayout = await temperature.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(style.lineHeight),
      whiteSpace: style.whiteSpace,
    };
  });
  expect(temperatureLayout.whiteSpace).toBe("nowrap");
  expect(temperatureLayout.height).toBeLessThanOrEqual(temperatureLayout.lineHeight + 1);
});

async function expectDescendingOutline(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const headings = await page.getByRole("heading").evaluateAll((elements) =>
    elements.map((element) => ({
      level: Number(element.tagName.slice(1)),
      size: Number.parseFloat(getComputedStyle(element).fontSize),
    })),
  );
  expect(headings.filter(({ level }) => level === 1)).toHaveLength(1);
  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    expect(current.level).toBeLessThanOrEqual(previous.level + 1);
    if (current.level > previous.level) {
      expect(current.size).toBeLessThanOrEqual(previous.size);
    }
  }
}
