// @vitest-environment node

import sharp from "sharp";
import { describe, expect, test, vi } from "vitest";
import { brand } from "@/lib/og";
import OpengraphImage from "./opengraph-image";

vi.mock("server-only", () => ({}));

describe("locale Open Graph image", () => {
  test.each(["fr", "en"])(
    "keeps the decorative divider below the %s wordmark",
    async (locale) => {
      const response = await OpengraphImage({
        params: Promise.resolve({ locale }),
      });
      const png = Buffer.from(await response.arrayBuffer());
      const { data, info } = await sharp(png)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const title = findColorBounds(data, info.width, info.height, brand.ink);
      const divider = findColorBounds(
        data,
        info.width,
        info.height,
        brand.honey,
      );

      expect(title.pixelCount).toBeGreaterThan(1_000);
      expect(divider.pixelCount).toBeGreaterThan(100);
      expect(divider.minY).toBeGreaterThan(title.maxY);
    },
  );
});

function findColorBounds(
  pixels: Buffer,
  width: number,
  height: number,
  hexColor: string,
) {
  const [red, green, blue] = hexColor
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16));
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let pixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      if (
        pixels[offset] === red &&
        pixels[offset + 1] === green &&
        pixels[offset + 2] === blue
      ) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        pixelCount += 1;
      }
    }
  }

  return { minY, maxY, pixelCount };
}
