import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

const slug = "tarte-de-demonstration";
const canonical = `https://les-bonnes-recettes-de-maman.vercel.app/fr/recettes/${slug}`;

test.beforeEach(async ({ page }) => {
  const jpeg = await sharp({ create: { width: 9, height: 16, channels: 3, background: "#F4F0E8" } }).jpeg().toBuffer();
  await page.route(`**/api/recipes/${slug}/poster?locale=*`, (route) => route.fulfill({
    contentType: "image/jpeg", body: jpeg,
    headers: { "Content-Disposition": `attachment; filename="${slug}.jpg"` },
  }));
});

test("desktop fallback offers canonical WhatsApp link, copy and JPEG download", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text: string) => { document.documentElement.dataset.copied = text; },
    } });
  });
  await page.goto(`/fr/recettes/${slug}?personnes=8&utm_source=test`);
  await page.getByRole("button", { name: "Partager la recette" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Lien de la recette")).toHaveValue(canonical);
  await expect(dialog.getByRole("button", { name: "Partager le lien…" })).toHaveCount(0);
  const whatsapp = new URL((await dialog.getByRole("link", { name: "WhatsApp", exact: true }).getAttribute("href"))!);
  expect(whatsapp.origin).toBe("https://wa.me");
  expect(whatsapp.searchParams.get("text")).toContain(canonical);
  await dialog.getByRole("button", { name: "Copier le lien" }).click();
  await expect(dialog.getByRole("status").filter({ hasText: "Lien copié." })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-copied", canonical);
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("link", { name: "Télécharger l’affiche · JPEG" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(`${slug}.jpg`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(accessibility.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Partager la recette" })).toBeFocused();
});

test("native shares send a canonical link or prepared JPEG during user activation", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data: ShareData) => data.files?.[0]?.type === "image/jpeg" });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      document.documentElement.dataset.shared = JSON.stringify({ url: data.url, title: data.title, filename: data.files?.[0]?.name, type: data.files?.[0]?.type, active: navigator.userActivation.isActive });
      throw new DOMException("User cancelled", "AbortError");
    } });
  });
  await page.goto(`/fr/recettes/${slug}`);
  await page.getByRole("button", { name: "Partager la recette" }).click();
  await page.getByRole("button", { name: "Partager le lien…" }).click();
  let payload = JSON.parse((await page.locator("html").getAttribute("data-shared"))!);
  expect(payload.url).toBe(canonical);
  expect(payload.active).toBe(true);
  await page.getByRole("button", { name: "Partager l’affiche…" }).click();
  payload = JSON.parse((await page.locator("html").getAttribute("data-shared"))!);
  expect(payload).toEqual({ filename: `${slug}.jpg`, type: "image/jpeg", active: true });
  await expect(page.getByText(/Le partage n’a pas abouti/)).toHaveCount(0);
});

test("clipboard rejection selects the URL and file rejection retains the download", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("Blocked", "NotAllowedError"); } });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });
  });
  await page.goto(`/fr/recettes/${slug}`);
  await page.getByRole("button", { name: "Partager la recette" }).click();
  await page.getByRole("button", { name: "Copier le lien" }).click();
  const input = page.getByLabel("Lien de la recette");
  await expect(input).toBeFocused();
  expect(await input.evaluate((element: HTMLInputElement) => element.value.slice(element.selectionStart!, element.selectionEnd!))).toBe(canonical);
  await expect(page.getByText("Sélectionnez et copiez ce lien pour le partager.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Partager l’affiche…" })).toHaveCount(0);
  await page.getByRole("button", { name: "Partager le lien…" }).click();
  await expect(page.getByText(/Le partage n’a pas abouti/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Télécharger l’affiche · JPEG" })).toBeVisible();
});

test("poster preparation errors leave link sharing usable and can be retried", async ({ page }) => {
  await page.route(`**/api/recipes/${slug}/poster?locale=*`, (route) => route.fulfill({ status: 503 }));
  await page.goto(`/en/recettes/${slug}`);
  await page.getByRole("button", { name: "Share recipe" }).click();
  await expect(page.getByText(/The poster is temporarily unavailable/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Download poster · JPEG" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Download poster · JPEG" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.unroute(`**/api/recipes/${slug}/poster?locale=*`);
  await page.route(`**/api/recipes/${slug}/poster?locale=*`, (route) => route.fulfill({ contentType: "image/jpeg", body: "test" }));
  await page.getByRole("button", { name: "Share recipe" }).click();
  await expect(page.getByText(/The poster is temporarily unavailable/)).toHaveCount(0);
  await expect(page.getByText("Preparing the poster…")).toHaveCount(0);
});
