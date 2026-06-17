import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Standard Open Graph / Twitter card dimensions. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Warm Hearth brand tokens, as sRGB hex for use inside next/og (Satori). */
export const brand = {
  cream: "#FBF6EE",
  ink: "#2A2118",
  terracotta: "#C0593B",
  honey: "#D99A3D",
  sand: "#EFE7DA",
  mutedInk: "#6B5E4F",
} as const;

type OgFont = {
  name: string;
  data: Buffer;
  weight: 700;
  style: "normal";
};

/** Load the vendored brand fonts for ImageResponse (ttf, Node runtime). */
export async function loadOgFonts(): Promise<OgFont[]> {
  const [playfair, nunito] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/PlayfairDisplay-Bold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/NunitoSans-Bold.ttf")),
  ]);
  return [
    { name: "Playfair Display", data: playfair, weight: 700, style: "normal" },
    { name: "Nunito Sans", data: nunito, weight: 700, style: "normal" },
  ];
}

/** A Lucide-style chef-hat glyph (echoes the app's icons) as an SVG string. */
export function chefHatSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/></svg>`;
}

/** Encode an SVG string as a data URI usable as an <img src> inside next/og. */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
