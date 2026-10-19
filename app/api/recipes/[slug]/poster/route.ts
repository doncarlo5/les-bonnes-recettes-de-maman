import sharp from "sharp";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { hasLocale } from "@/i18n/config";
import { getRecipeShareImageUrl } from "@/lib/recipe-share-image";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = new URL(request.url).searchParams.get("locale") ?? "fr";
  if (!hasLocale(locale) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    // Only published recipes are accessible; clients cannot supply an image URL.
    const recipe = await fetchQuery(api.recipes.getBySlug, { locale, slug });
    if (!recipe) return new Response("Not found", { status: 404 });
    const sharingImage = getRecipeShareImageUrl(slug, recipe.heroImageUrl);
    if (!sharingImage) return new Response("Not found", { status: 404 });
    const source = new URL(sharingImage, siteUrl);
    if (source.protocol !== "https:" || !(
      source.origin === new URL(siteUrl).origin ||
      source.hostname.endsWith(".convex.cloud") ||
      source.hostname === "images.unsplash.com"
    )) throw new Error("Unsupported poster source");
    const image = await fetch(source, { signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (!image.ok) throw new Error("Poster unavailable");
    const jpeg = await sharp(Buffer.from(await image.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(1080, 1920, { fit: "contain", background: "#F4F0E8" })
      .flatten({ background: "#F4F0E8" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${slug}.jpg"`,
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Poster temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
