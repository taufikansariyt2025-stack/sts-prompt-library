import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

/**
 * The R2 CDN host, or null when storage isn't configured.
 *
 * Returning null rather than a placeholder matters: registering a made-up host
 * in remotePatterns would silently allow images from a domain we don't own.
 */
const cdnHost: string | null = (() => {
  const raw = process.env.NEXT_PUBLIC_CDN_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
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
  /*
   * `same-origin-allow-popups`, not `same-origin`.
   *
   * Firebase's signInWithPopup opens a window at accounts.google.com and relies
   * on that popup posting the credential back through `window.opener`. Strict
   * `same-origin` severs that reference, so the popup completes at Google and
   * the result never reaches the app — sign-in hangs and no account is ever
   * created, with no error in the console to explain it.
   *
   * The relaxed value keeps the protection that matters here (a cross-origin
   * page still can't get a handle on our window) while letting popups WE open
   * talk back to us.
   */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
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
      ...(cdnHost ? [{ protocol: "https" as const, hostname: cdnHost }] : []),
      { protocol: "https" as const, hostname: "i.ytimg.com" },
      { protocol: "https" as const, hostname: "img.youtube.com" },
      // Google account avatars shown in the admin access queue.
      { protocol: "https" as const, hostname: "lh3.googleusercontent.com" },
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
