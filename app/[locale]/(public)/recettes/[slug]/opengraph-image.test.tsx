// @vitest-environment node
import sharp from "sharp";
import { afterEach, expect, test, vi } from "vitest";
import RecipeOpengraphImage from "./opengraph-image";

vi.mock("server-only", () => ({}));
vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(async () => ({
    title: "Sauce bolognaise",
    heroImageUrl: "https://example.com/photo.webp",
    timeLabel: "40 min",
  })),
}));
afterEach(() => vi.unstubAllGlobals());

test("renders the recipe photo, not the AI poster, as a full-bleed sharing card", async () => {
  const webp = await sharp({ create: {
    width: 160, height: 90, channels: 3, background: "#cc2233",
  } }).webp().toBuffer();
  const originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input) === "https://example.com/photo.webp"
      ? new Response(new Uint8Array(webp))
      : originalFetch(input, init),
  ));
  const response = await RecipeOpengraphImage({ params: Promise.resolve({ locale: "fr", slug: "sauce-bolognaise" }) });
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  const output = sharp(Buffer.from(await response.arrayBuffer()));
  const metadata = await output.metadata();
  expect([metadata.width, metadata.height]).toEqual([1200, 630]);
  const { data, info } = await output.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // The photo must fill the card edge to edge; a blank image can still return 200.
  for (const x of [20, 1180]) {
    const offset = (40 * info.width + x) * info.channels;
    expect(data[offset]).toBeGreaterThan(150);
    expect(data[offset + 1]).toBeLessThan(80);
  }
});


test("still returns a branded preview when the photo cannot be loaded", async () => {
  const originalFetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input) === "https://example.com/photo.webp"
      ? new Response(null, { status: 503 })
      : originalFetch(input, init),
  ));
  const response = await RecipeOpengraphImage({ params: Promise.resolve({ locale: "en", slug: "sauce-bolognaise" }) });
  expect(response.status).toBe(200);
  const output = sharp(Buffer.from(await response.arrayBuffer()));
  const metadata = await output.metadata();
  expect([metadata.format, metadata.width, metadata.height]).toEqual(["jpeg", 1200, 630]);
  const stats = await output.stats();
  expect(stats.channels[0].stdev).toBeGreaterThan(10);
});
