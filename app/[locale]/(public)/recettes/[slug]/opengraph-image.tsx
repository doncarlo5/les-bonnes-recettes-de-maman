import { ImageResponse } from "next/og";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale, defaultLocale, type Locale } from "@/i18n/config";
import { brand, chefHatSvg, loadOgFonts, svgDataUri } from "@/lib/og";

export const alt = "Les bonnes recettes de maman";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

  // No recipe (or no photo): fall back to a branded cream card.
  if (!recipe || !recipe.heroImageUrl) {
    return new ImageResponse(
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
              fontFamily: "Playfair Display",
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
                fontFamily: "Nunito Sans",
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
    );
  }

  // Photo card mirroring the recipe detail hero.
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        <img
          src={recipe.heroImageUrl}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
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
                fontFamily: "Nunito Sans",
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
              fontFamily: "Playfair Display",
              fontSize: 84,
              lineHeight: 1.0,
              color: "#FFFFFF",
              maxWidth: 1000,
            }}
          >
            {recipe.title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 32,
            }}
          >
            <img
              width={40}
              height={40}
              src={svgDataUri(chefHatSvg(brand.cream))}
              alt=""
              style={{ marginRight: 16 }}
            />
            <div
              style={{
                fontFamily: "Nunito Sans",
                fontSize: 28,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {wordmark}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
