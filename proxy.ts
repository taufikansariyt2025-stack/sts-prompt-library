import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renamed `middleware` to `proxy`. It runs on the Node runtime.
 *
 * Two jobs, both deliberately cheap — the proxy runs on every request and the
 * docs warn against relying on shared modules here:
 *
 *  1. An OPTIMISTIC gate — is a session cookie present at all?
 *  2. Set the Content-Security-Policy.
 *
 * (1) is a redirect convenience, NOT a security boundary. The cookie is only
 * verified against Firebase in `requireSession()` / `requireAdmin()`, which the
 * gated layouts and every mutating route call for themselves. A forged cookie
 * gets past this file and no further. See CLAUDE.md rule #5.
 *
 * ---------------------------------------------------------------------------
 * Why the CSP is split
 * ---------------------------------------------------------------------------
 * A nonce must be unique per request, so Next.js can only apply it while
 * rendering dynamically — a nonce on a static route would disable prerendering.
 *
 * The library is gated, so it reads the session cookie and is already dynamic;
 * it costs nothing to give it a strict nonce CSP. Only the landing and sign-in
 * pages remain static, and they fall back to 'unsafe-inline' because React's
 * streaming payload is injected inline. Those two pages carry no session and
 * no user content, so the trade-off is contained.
 */

const SESSION_COOKIE = "sts_session";

const isDev = process.env.NODE_ENV === "development";

/** Reachable without an account. Everything else requires a session. */
const PUBLIC_PATHS = new Set(["/", "/login", "/offline"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Auth endpoints must stay reachable so sign-in and sign-out can work.
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/health") return true;
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return true;
  // The session exchange itself is called before a cookie exists.
  if (pathname === "/api/admin/session") return true;
  // Legacy alias that just redirects to /login.
  if (pathname === "/admin/login") return true;
  return false;
}

function cdnOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_CDN_URL ?? "").origin;
  } catch {
    return "";
  }
}

/**
 * Firebase Auth's sign-in domain, e.g. https://my-project.firebaseapp.com.
 *
 * The popup/redirect flow loads a hidden iframe from `<authDomain>/__/auth/iframe`
 * and a helper script from apis.google.com. If the CSP blocks either, the SDK
 * surfaces the failure as an opaque `auth/internal-error` — which is exactly
 * what it looks like when Google sign-in "just doesn't work".
 */
function firebaseAuthOrigin(): string {
  const domain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  return domain ? `https://${domain}` : "";
}

function buildCsp(scriptSrc: string): string {
  const cdn = cdnOrigin();
  const authOrigin = firebaseAuthOrigin();
  return [
    `default-src 'self'`,
    // apis.google.com: Firebase Auth popup/redirect resolver.
    // cloudflareinsights: the Web Analytics beacon Cloudflare injects at the edge.
    `script-src ${scriptSrc} https://apis.google.com https://static.cloudflareinsights.com`,
    // Tailwind injects styles at runtime; inline styles are unavoidable and
    // far lower risk than inline scripts.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${cdn} https://i.ytimg.com https://img.youtube.com https://lh3.googleusercontent.com`,
    `media-src 'self' ${cdn}`,
    `font-src 'self' data:`,
    `frame-src 'self' ${authOrigin} https://accounts.google.com https://apis.google.com https://www.youtube-nocookie.com https://www.youtube.com`,
    `connect-src 'self' ${cdn} ${authOrigin} https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://cloudflareinsights.com${
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
  const { pathname, search } = request.nextUrl;
  const hasCookie = request.cookies.has(SESSION_COOKIE);
  const isPublic = isPublicPath(pathname);

  // ── Optimistic gate ────────────────────────────────────────────────────────
  if (!isPublic && !hasCookie) {
    // API callers get a 401 rather than an HTML redirect they can't use.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Signed-in users shouldn't sit on the sign-in screen.
  if (pathname === "/login" && hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/prompts";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ── CSP ────────────────────────────────────────────────────────────────────
  // Static routes can't carry a nonce; everything gated is dynamic, so it can.
  const staticRoute = pathname === "/" || pathname === "/login";

  if (staticRoute) {
    const csp = buildCsp(`'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`);
    const response = NextResponse.next();
    response.headers.set("content-security-policy", csp);
    return response;
  }

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

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation. Without this the
     * proxy would run on CSS/JS/font requests and the gate could block them.
     */
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icons/|screenshots/|manifest.webmanifest|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
