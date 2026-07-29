import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const animationCss = readFileSync(
  new URL("./recipe-loader-animation.module.css", import.meta.url),
  "utf8",
);
const loadingCss = readFileSync(
  new URL("./localized-loading.module.css", import.meta.url),
  "utf8",
);

describe("mobile recipe loader", () => {
  test("renders as a compact, crisp vector animation", () => {
    expect(animationCss).not.toMatch(/filter:\s*blur\(/);
    expect(loadingCss).toMatch(
      /@media \(max-width: 40rem\)[\s\S]*?\.loader\s*\{[\s\S]*?width: min\(9rem, 42vw\)/,
    );
  });
});
