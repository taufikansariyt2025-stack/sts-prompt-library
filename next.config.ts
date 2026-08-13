import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const cdnHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_CDN_URL ?? "https://cdn.example.com").hostname;
  } catch {
    return "cdn.example.com";
  }
})();

/**
 * Security headers.
 *
 * CSP is set per-request in proxy.ts because script-src needs a fresh nonce.
 * Everything here is static and safe to send from the config.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  /*
   * Emits `.next/standalone/server.js` with a traced, minimal node_modules.
   * Required by the Docker image — the runner stage copies only that bundle,
   * which is what keeps the final image small and avoids shipping pnpm's
   * symlinked store. Harmless for Vercel, which ignores it.
   */
  output: "standalone",

  reactStrictMode: true,

  // Stable in Next 16 — auto-memoises components and cuts re-renders.
  reactCompiler: true,

  typedRoutes: true,

  images: {
    // `domains` is deprecated in Next 16; remotePatterns is the supported form.
    remotePatterns: [
      { protocol: "https", hostname: cdnHost },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
    formats: ["image/avif", "image/webp"],
    // Media is immutable (content-hashed keys), so cache hard.
    minimumCacheTTL: 31_536_000,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The admin panel must never be indexed or cached.
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },

  // Keep native/heavy server deps out of the bundler.
  serverExternalPackages: ["firebase-admin", "sharp"],
};

export default bundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(nextConfig);
