import type { MetadataRoute } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { defaultLocale } from "@/i18n/config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const dict = await getDictionary(defaultLocale);

  return {
    name: dict.site.wordmark,
    short_name: "Recettes Maman",
    description: dict.site.description,
    start_url: "/",
    display: "standalone",
    lang: defaultLocale,
    background_color: "#F4F0E8",
    theme_color: "#7C2538",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
