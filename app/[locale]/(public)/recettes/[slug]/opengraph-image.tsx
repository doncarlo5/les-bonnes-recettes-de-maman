import { ImageResponse } from "next/og";
import sharp from "sharp";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale, defaultLocale, type Locale } from "@/i18n/config";
import { brand, chefHatSvg, loadOgFonts, resolveOgImageUrl, svgDataUri } from "@/lib/og";
import { siteUrl } from "@/lib/site";

export const alt = "Les bonnes recettes de maman";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

async function compressedPreview(image: ImageResponse) {
  const jpeg = await sharp(Buffer.from(await image.arrayBuffer()))
    .jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300, s-maxage=3600",
  } });
}

export default async function RecipeOpengraphImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale: Locale = hasLocale(rawLocale) ? rawLocale : defaultLocale;
  const [dict, fonts, recipe] = await Promise.all([
    getDictionary(locale),
    loadOgFonts(),
    fetchQuery(api.recipes.getBySlug, { locale, slug }).catch(() => null),
  ]);

  const wordmark = dict.site.wordmark;

  let imageSrc: string | undefined;
  // Link previews show the recipe photograph, not the AI sharing poster.
  if (recipe?.heroImageUrl) {
    try {
      // Satori cannot embed WebP reliably. Decode and crop the photo first.
      const response = await fetch(resolveOgImageUrl(recipe.heroImageUrl, siteUrl), {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Photo unavailable");
      const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
        .rotate().resize(size.width, size.height, { fit: "cover" }).jpeg({ quality: 90 }).toBuffer();
      imageSrc = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    } catch {
      // An unavailable photo must not prevent the recipe link from having a card.
    }
  }

  // No recipe or usable photo: fall back to a branded cream card.
  if (!recipe || !imageSrc) {
    return compressedPreview(new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: brand.cream,
            padding: 96,
            textAlign: "center",
          }}
        >
          <img
            width={96}
            height={96}
            src={svgDataUri(chefHatSvg(brand.terracotta))}
            alt=""
            style={{ marginBottom: 36 }}
          />
          <div
            style={{
              fontFamily: "Newsreader",
              fontSize: 84,
              lineHeight: 1.05,
              color: brand.ink,
              maxWidth: 960,
            }}
          >
            {recipe ? recipe.title : wordmark}
          </div>
          {recipe ? (
            <div
              style={{
                fontFamily: "Source Sans 3",
                fontSize: 30,
                color: brand.mutedInk,
                marginTop: 28,
              }}
            >
              {wordmark}
            </div>
          ) : null}
        </div>
      ),
      { ...size, fonts },
    ));
  }

  // Photo card mirroring the recipe detail hero.
  return compressedPreview(new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        <img
          src={imageSrc}
          alt=""
          width={size.width}
          height={size.height}
          style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.78))",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            padding: 80,
          }}
        >
          {recipe.timeLabel ? (
            <div
              style={{
                fontFamily: "Source Sans 3",
                fontSize: 26,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: brand.honey,
                marginBottom: 20,
              }}
            >
              {recipe.timeLabel}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: "Newsreader",
              fontSize: recipe.title.length > 55 ? 64 : 84,
              lineHeight: 1.0,
              color: "#FFFFFF",
              maxWidth: 1000,
            }}
          >
            {recipe.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 32 }}>
            <img
              width={40}
              height={40}
              src={svgDataUri(chefHatSvg(brand.cream))}
              alt=""
              style={{ marginRight: 16 }}
            />
            <div style={{ fontFamily: "Source Sans 3", fontSize: 28, color: "rgba(255,255,255,0.92)" }}>
              {wordmark}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  ));
}
