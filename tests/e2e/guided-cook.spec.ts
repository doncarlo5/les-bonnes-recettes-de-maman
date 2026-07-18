import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function installWakeLockMock(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const state = { requests: 0, releases: 0 };
    Object.assign(window, { __wakeLockState: state });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          state.requests += 1;
          return {
            release: async () => {
              state.releases += 1;
            },
            addEventListener: () => undefined,
          };
        },
      },
    });
  });
}

test("a cook can advance, check ingredients, and resume locally", async ({ page }) => {
  await installWakeLockMock(page);
  await page.goto("/fr/recettes/tarte-de-demonstration");
  await page.getByRole("link", { name: "Commencer à cuisiner" }).click();

  await expect(page).toHaveURL(/\/cuisiner$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mélanger");
  await page.getByRole("button", { name: /Ingrédients/ }).click();
  await page.getByText("Farine", { exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Étape suivante" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cuire");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cuire");
  await page.getByLabel("Garder l’écran allumé").check();
  await expect(page.getByText(/restera allumé/)).toBeVisible();

  const violations = await new AxeBuilder({ page }).analyze();
  expect(
    violations.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("completion, restart, locale isolation, and wake-lock lifecycle stay local", async ({ page }) => {
  await installWakeLockMock(page);
  await page.goto("/fr/recettes/tarte-de-demonstration/cuisiner");
  await page.getByLabel("Garder l’écran allumé").check();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __wakeLockState: { requests: number } }).__wakeLockState.requests)).toBe(1);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __wakeLockState: { releases: number } }).__wakeLockState.releases)).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __wakeLockState: { requests: number } }).__wakeLockState.requests)).toBe(2);

  await page.getByRole("button", { name: "Étape suivante" }).click();
  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(page.getByRole("heading", { name: "C’est prêt" })).toBeVisible();
  await page.locator("section").getByRole("link", { name: "Retour à la recette" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __wakeLockState: { releases: number } }).__wakeLockState.releases)).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("link", { name: "Reprendre la recette" })).toBeVisible();
  await page.getByRole("button", { name: "Recommencer" }).click();
  await expect(page.getByRole("link", { name: "Commencer à cuisiner" })).toBeVisible();

  await page.goto("/en/recettes/tarte-de-demonstration");
  await expect(page.getByRole("link", { name: "Start cooking" })).toBeVisible();
});

test("wake lock is opt-in and degrades quietly when unsupported", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
  });
  await page.goto("/fr/recettes/tarte-de-demonstration/cuisiner");
  await expect(page.getByLabel("Garder l’écran allumé")).toBeDisabled();
  await expect(page.getByText(/n’est pas disponible/)).toBeVisible();
});

test("the legacy collection URL preserves discovery state", async ({ page }) => {
  await page.goto("/fr/recettes?q=tarte&cat=dessert&view=list&sort=date");
  await expect(page).toHaveURL(/\/fr\?q=tarte&cat=dessert&view=list&sort=date#recettes$/);
  await expect(page.getByRole("searchbox")).toHaveValue("tarte");
});

test("homepage discovery state remains URL-backed", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("searchbox").fill("tarte");
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page).toHaveURL(/q=tarte/);

  const disclosure = page.getByText("Filtres et affichage", { exact: true });
  if (await disclosure.isVisible()) await disclosure.click();
  await page.getByRole("button", { name: "Dessert" }).click();
  await expect(page).toHaveURL(/cat=dessert/);
  await page.getByRole("button", { name: "Vue liste" }).click();
  await expect(page).toHaveURL(/view=list/);
  await page.getByRole("button", { name: "Date d’ajout" }).click();
  await expect(page).toHaveURL(/sort=date/);
});
