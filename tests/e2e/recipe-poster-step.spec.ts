import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const editor = "/fr/admin/recettes?slug=tarte-de-demonstration";

test("the guided poster prompt uses current form values and offers image import", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { document.documentElement.dataset.prompt = text; } } });
  });
  await page.route("**/api/admin/recipes/save", route => route.fulfill({ json: { type: "success", slug: "tarte-de-demonstration", revision: 4, savedAt: Date.now() } }));
  await page.goto(editor);
  await page.getByText("Prompts d’affiche pour le partage", { exact: true }).click();
  const panel = page.getByRole("region", { name: "Générer l’affiche" });
  await expect(panel).toBeVisible();
  await page.getByLabel("Titre", { exact: true }).fill("Tarte aux pommes de Mamie");
  await panel.getByLabel("Couleur d’accent").selectOption("forest green");
  await panel.getByLabel("Composition de l’affiche").selectOption("diagonal split");
  await panel.getByRole("button", { name: "Copier le prompt de l’affiche" }).click();
  const copied = await page.locator("html").getAttribute("data-prompt");
  expect(copied).toContain("[HEADLINE]: Tarte aux pommes de Mamie");
  expect(copied).toContain("[ACCENT COLOR]: forest green");
  expect(copied).toContain("[LAYOUT]: diagonal split");
  expect(copied).toContain("Farine");
  expect(copied).toContain("Vanille");
  expect(copied).toContain("Mélanger les ingrédients.");
  await expect(panel.getByRole("status")).toContainText("Prompt copié");
  await page.getByLabel("Titre", { exact: true }).fill("Une autre tarte");
  await expect(panel.getByRole("status", { includeHidden: true })).toBeEmpty();
  const accessibility = await new AxeBuilder({ page }).include('[aria-label="Générer l’affiche"]').analyze();
  expect(accessibility.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  await page.getByRole("button", { name: "Remplacer l’image", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choisir un fichier", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("clipboard failure exposes a selectable prompt and incomplete recipes cannot copy it", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Blocked"); } } });
  });
  await page.goto(editor);
  await page.getByText("Prompts d’affiche pour le partage", { exact: true }).click();
  const copy = page.getByRole("button", { name: "Copier le prompt de l’affiche" });
  await copy.click();
  const prompt = page.getByLabel("Prompt de génération de l’affiche");
  await expect(prompt).toBeVisible();
  await expect(prompt).toBeFocused();
  expect(await prompt.evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBeGreaterThan(1000);
  await page.getByLabel("Titre", { exact: true }).fill("");
  await expect(copy).toBeDisabled();
});

test("both poster proposals remain available with their own composition choices", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { document.documentElement.dataset.prompt = text; } } });
  });
  await page.goto(editor);
  await page.getByText("Prompts d’affiche pour le partage", { exact: true }).click();
  await page.getByLabel("Proposition visuelle").selectOption("food-structure");
  await page.getByLabel("Structure de l’affiche").selectOption("photo-filled type");
  await expect(page.getByLabel("Composition de l’affiche")).toHaveCount(0);
  await page.getByRole("button", { name: "Copier le prompt de l’affiche" }).click();
  let prompt = await page.locator("html").getAttribute("data-prompt");
  expect(prompt).toContain("[STRUCTURE]: photo-filled type");
  expect(prompt).not.toContain("[LAYOUT]");
  await page.getByLabel("Proposition visuelle").selectOption("editorial");
  await expect(page.getByLabel("Composition de l’affiche")).toBeVisible();
  await page.getByRole("button", { name: "Copier le prompt de l’affiche" }).click();
  prompt = await page.locator("html").getAttribute("data-prompt");
  expect(prompt).toContain("[LAYOUT]: annotated flat lay");
  expect(prompt).not.toContain("[STRUCTURE]");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
