/** @type {import('next').NextConfig} */
const nextConfig = {
  // Messaging apps may fetch as ordinary browsers: always include previews in head.
  htmlLimitedBots: /.*/,
  // Sharp's libvips version differs from Next.js's bundled copy. Trace the
  // app's native library explicitly for recipe metadata and image conversion.
  outputFileTracingIncludes: {
    "/*": ["node_modules/@img/sharp-libvips-*/lib/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.convex.cloud",
      },
    ],
  },
};

export default nextConfig;
