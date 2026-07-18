import { describe, expect, it } from "vitest";
import { loadOgFonts } from "./og";

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
