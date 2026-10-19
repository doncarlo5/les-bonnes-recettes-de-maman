import { expect, test } from "vitest";
import { buildRecipePosterPrompt } from "./recipe-poster-prompt";

const recipe = {
  title: "Tarte aux fraises", description: "Une tarte fraîche.", timeLabel: "45 min",
  ingredients: [{ name: "Fraises", quantity: "500", unit: "g" }],
  subRecipes: [{ title: "Crème", ingredients: [{ name: "Vanille" }] }],
  sections: [{ title: "Assemblage", steps: [{ text: "Garnir la pâte cuite avec les fraises." }] }],
};

test("prepares the approved editorial prompt from the recipe, including its subrecipes and preparation", () => {
  const prompt = buildRecipePosterPrompt(recipe);
  expect(prompt).toContain("[HEADLINE]: Tarte aux fraises");
  expect(prompt).toContain("[DETAILS]: Fraises, Vanille · 45 min");
  expect(prompt).toContain("9:16 vertical food editorial poster");
  expect(prompt).toContain("cream paper background");
  expect(prompt).toContain("Garnir la pâte cuite");
  expect(prompt).not.toContain("undefined");
  expect(prompt).not.toMatch(/\{brand name\}|\{main product\}/);
});

test("reflects new recipe text and selected art direction without carrying the previous recipe", () => {
  const prompt = buildRecipePosterPrompt({ ...recipe, title: "Tarte aux pommes", ingredients: [{ name: "Pommes" }], subRecipes: [] }, { accent: "forest green", layout: "diagonal split" });
  expect(prompt).toContain("[HEADLINE]: Tarte aux pommes");
  expect(prompt).toContain("[ACCENT COLOR]: forest green");
  expect(prompt).toContain("[LAYOUT]: diagonal split");
  expect(prompt).not.toContain("[HEADLINE]: Tarte aux fraises");
});

test("the second proposal retains its four structures without mixing the first prompt headers", () => {
  for (const structure of ["photo-filled type", "food layers as grid", "modular editorial grid", "steam veil"]) {
    const prompt = buildRecipePosterPrompt(recipe, { proposal: "food-structure", structure });
    expect(prompt).toContain(`[STRUCTURE]: ${structure}`);
    expect(prompt).toContain("[FOOD / DISH]: Tarte aux fraises");
    expect(prompt).toContain("one continuous food photograph");
    expect(prompt).toContain("Do not use digital blur or smoke effects");
    expect(prompt).not.toContain("[LAYOUT]");
    expect(prompt).not.toContain("[SUBHEAD]");
  }
  const original = buildRecipePosterPrompt(recipe);
  expect(original).toContain("[LAYOUT]: annotated flat lay");
  expect(original).not.toContain("[STRUCTURE]");
});
