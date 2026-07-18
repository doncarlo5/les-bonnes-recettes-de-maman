import { ImageResponse } from "next/og";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale, defaultLocale } from "@/i18n/config";
import { brand, chefHatSvg, loadOgFonts, svgDataUri } from "@/lib/og";

export const alt = "Les bonnes recettes de maman";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [dict, fonts] = await Promise.all([
    getDictionary(hasLocale(locale) ? locale : defaultLocale),
    loadOgFonts(),
  ]);

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
          width={104}
          height={104}
          src={svgDataUri(chefHatSvg(brand.terracotta))}
          alt=""
          style={{ marginBottom: 40 }}
        />
        <div
          style={{
            fontFamily: "Source Sans 3",
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: brand.terracotta,
            marginBottom: 28,
          }}
        >
          {dict.site.tagline}
        </div>
        <div
          style={{
            fontFamily: "Newsreader",
            fontSize: 96,
            lineHeight: 1.05,
            color: brand.ink,
            maxWidth: 900,
          }}
        >
          {dict.site.wordmark}
        </div>
        <div
          style={{
            width: 96,
            height: 6,
            borderRadius: 3,
            background: brand.honey,
            marginTop: 44,
          }}
        />
      </div>
    ),
    { ...size, fonts },
  );
}
