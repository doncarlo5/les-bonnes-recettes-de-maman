// @vitest-environment node
import sharp from "sharp";
import { afterEach, expect, test, vi } from "vitest";
import { fetchQuery } from "convex/nextjs";
import { GET } from "./route";

vi.mock("convex/nextjs", () => ({ fetchQuery: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
const request = (slug = "example-recipe", locale = "fr") => GET(
  new Request(`https://example.com/api/recipes/${slug}/poster?locale=${locale}`),
  { params: Promise.resolve({ slug }) },
);

test("downloads a public poster as a complete 1080 × 1920 JPEG", async () => {
  vi.mocked(fetchQuery).mockResolvedValue({ heroImageUrl: "https://test.convex.cloud/api/storage/poster" });
  const input = await sharp({ create: { width: 90, height: 160, channels: 3, background: "#cc2233" } }).webp().toBuffer();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(input))));
  const response = await request();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="example-recipe.jpg"');
  const output = sharp(Buffer.from(await response.arrayBuffer()));
  const metadata = await output.metadata();
  expect([metadata.format, metadata.width, metadata.height]).toEqual(["jpeg", 1080, 1920]);
  const stats = await output.stats();
  expect(stats.channels[0].mean).toBeGreaterThan(190);
  expect(stats.channels[1].mean).toBeLessThan(50);
});

test("does not expose missing/private recipes or accept unvalidated input", async () => {
  vi.mocked(fetchQuery).mockResolvedValue(null);
  expect((await request()).status).toBe(404);
  vi.mocked(fetchQuery).mockClear();
  expect((await request("bad\"slug")).status).toBe(404);
  expect((await request("example-recipe", "de")).status).toBe(404);
  expect(fetchQuery).not.toHaveBeenCalled();
});

test("fails without fetching unapproved image hosts and does not cache errors", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(fetchQuery).mockResolvedValue({ heroImageUrl: "http://127.0.0.1/private" });
  const response = await request();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("handles storage failure with a retryable response", async () => {
  vi.mocked(fetchQuery).mockResolvedValue({ heroImageUrl: "https://test.convex.cloud/api/storage/poster" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
  expect((await request()).status).toBe(503);
});
