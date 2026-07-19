export function getConvexSiteUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_SITE_URL
    ?? process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".convex.cloud", ".convex.site")
    ?? null;
}
