import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renamed `middleware` to `proxy`. It runs on the Node runtime.
 *
 * Three jobs, all deliberately cheap — the proxy runs on every request and the
 * docs warn against relying on shared modules here:
 *
 *  1. Set the Content-Security-Policy (split policy, see below).
 *  2. Do an OPTIMISTIC admin session check — cookie present or not.
 *  3. Hand the admin nonce down via a request header.
 *
 * (2) is a redirect convenience, NOT a security boundary. The cookie is only
 * verified against Firebase in `requireAdmin()`, which every admin page and
 * every mutating route handler calls for itself. See CLAUDE.md rule #5.
 *
 * ---------------------------------------------------------------------------
 * Why the CSP is split
 * ---------------------------------------------------------------------------
 * A nonce must be unique per request, so Next.js can only apply it while
 * rendering dynamically. Using a nonce site-wide would disable static
 * rendering, ISR and CDN caching — which is the entire scaling strategy for
 * the public library (PRD §17).
 *
 * So:
 *   • /admin/*  → strict nonce CSP. Already dynamic and `no-store`, and it is
 *                 the only surface with an authenticated session to protect.
 *   • public    → static CSP with 'unsafe-inline' for scripts, because React's
 *                 streaming payload is injected inline. Acceptable here: these
 *                 pages carry no session, all content renders as text nodes
 *                 (dangerouslySetInnerHTML is banned repo-wide), and there is
 *                 no user-generated content. object-src, base-uri and
 *                 frame-ancestors stay locked down either way.
 *
 * Setting a header from the proxy does NOT force dynamic rendering; only
 * *reading* headers() inside a page does. That is why public pages stay static.
 */

const SESSION_COOKIE = "sts_session";

const isDev = process.env.NODE_ENV === "development";

function cdnOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_CDN_URL ?? "").origin;
  } catch {
    return "";
  }
}

function buildCsp(scriptSrc: string): string {
  const cdn = cdnOrigin();
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // Tailwind injects styles at runtime; inline styles are unavoidable and
    // far lower risk than inline scripts.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${cdn} https://i.ytimg.com https://img.youtube.com`,
    `media-src 'self' ${cdn}`,
    `font-src 'self' data:`,
    `frame-src https://www.youtube-nocookie.com https://www.youtube.com`,
    `connect-src 'self' ${cdn} https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com${
      isDev ? " ws: http://localhost:*" : ""
    }`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ")
    .replace(/\s{2,}/g, " ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  // --- Optimistic admin gate -------------------------------------------------
  const isProtectedPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  if (isProtectedPage && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Signed-in admins shouldn't land back on the login screen.
  if (pathname === "/admin/login" && request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // --- CSP -------------------------------------------------------------------
  if (isAdmin) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = buildCsp(
      `'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    );

    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);

    const response = NextResponse.next({ request: { headers } });
    response.headers.set("content-security-policy", csp);
    return response;
  }

  const csp = buildCsp(`'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`);
  const response = NextResponse.next();
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation. Without this the
     * proxy would run on CSS/JS/font requests and the admin redirect could
     * block them.
     */
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icons/|screenshots/|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
