import { describe, expect, it } from "vitest";
import { loadOgFonts, resolveOgImageUrl } from "./og";

describe("loadOgFonts", () => {
  it("loads both vendored brand fonts for Open Graph rendering", async () => {
    const fonts = await loadOgFonts();

    expect(fonts.map(({ name }) => name)).toEqual([
      "Newsreader",
      "Source Sans 3",
    ]);
    for (const font of fonts) {
      expect(font.weight).toBe(700);
      expect(font.style).toBe("normal");
      expect(font.data.byteLength).toBeGreaterThan(10_000);
    }
  });
});

describe("resolveOgImageUrl", () => {
  it("resolves a local public image against the site URL", () => {
    expect(
      resolveOgImageUrl(
        "/images/recipes/soupe-de-champagne.png",
        "https://recettes.example/fr/recettes/soupe-de-champagne",
      ),
    ).toBe("https://recettes.example/images/recipes/soupe-de-champagne.png");
  });

  it("keeps an absolute remote image URL unchanged", () => {
    expect(
      resolveOgImageUrl(
        "https://images.example/photo.jpg",
        "https://recettes.example",
      ),
    ).toBe("https://images.example/photo.jpg");
  });
});
