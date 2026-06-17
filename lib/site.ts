/**
 * Canonical site origin used for metadataBase, Open Graph URLs, the sitemap,
 * and robots. Override per environment with NEXT_PUBLIC_SITE_URL (e.g. a custom
 * domain); falls back to the Vercel production URL.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://les-bonnes-recettes-de-maman.vercel.app";
