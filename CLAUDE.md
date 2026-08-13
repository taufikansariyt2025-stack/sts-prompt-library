@AGENTS.md

# CLAUDE.md

Engineering guide for **STS Prompt Library** — a public AI image & video prompt library with a private admin panel, built for [Skills To Salary](https://skillstosalary.com).

**Read [PRD.md](PRD.md) for scope, screens and product decisions.** This file covers *how we build*, not *what we build*.

> **Next.js 16 is not the Next.js in your training data.** `middleware` is now `proxy`, `revalidateTag` takes a second argument, params are Promises, and `next lint` is gone. Version-matched docs ship at `node_modules/next/dist/docs/` — read them before writing framework code. See [Next 16 specifics](#nextjs-16-specifics).

---

## Quick reference

```bash
pnpm install              # always pnpm — a preinstall guard blocks npm/yarn
pnpm dev                  # dev server (Turbopack) on :3000
pnpm build                # production build
pnpm start                # serve the production build
pnpm typecheck            # tsc --noEmit
pnpm lint                 # eslint (note: `next lint` was removed in 16)
pnpm test                 # vitest — 68 unit tests
pnpm check                # typecheck + lint + test — run before every commit

pnpm extract:docx         # source .docx → scripts/data/extracted-prompts.json
pnpm seed                 # push categories, settings and prompts to Firestore
pnpm seed -- --publish    # …publishing immediately instead of as drafts
pnpm set:admin <email>    # grant the Firebase Auth admin claim
pnpm analyze              # bundle analyzer
```

---

## Stack

| | |
|---|---|
| Next.js **16.3** (App Router, Turbopack) · React 19.2 · TypeScript strict | Tailwind CSS v4 · Radix (`radix-ui`) · lucide-react |
| Firebase Firestore (data) · firebase-admin (all writes) · Firebase Auth (admin) | Cloudflare R2 via AWS SDK v3 (media) |
| Zod v4 · react-hook-form · MiniSearch · next-themes | Vitest · Playwright · ESLint 9 flat config |

---

## Non-negotiable rules

These exist because breaking them causes real security or performance failures.

### 1. Never write to Firestore from the client
`firestore.rules` denies **all** client writes (`allow write: if false` on every collection). Every mutation goes through a Route Handler using `firebase-admin`, which bypasses rules. That is deliberate: it is the only path where Zod validation, the audit log and cache revalidation all run.

```ts
// ✗ Never
import { updateDoc } from "firebase/firestore";

// ✓ Always
await fetch(`/api/admin/prompts/${id}`, { method: "PATCH", body: JSON.stringify(data) });
```

### 2. Never expose server secrets to the client
`R2_SECRET_ACCESS_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY` must never be `NEXT_PUBLIC_`. Server modules (`lib/r2/*`, `lib/firebase/admin.ts`, `lib/auth/*`, `lib/security/*`, `lib/api/*`) all start with `import "server-only"`.

### 3. Never render user content as HTML
`react/no-danger` is an ESLint **error**. Prompt text renders as a plain text node with `white-space: pre-wrap` (the `.prompt-text` utility). This is both XSS-safe and *correct* — the source prompts contain `[brackets]`, `**asterisks**` and timestamps that must survive verbatim.

The one allowed exception is the JSON-LD `<script>` in the prompt detail page: it serialises our own typed object and escapes `<`. It carries an explicit eslint-disable with that reasoning.

### 4. Every API boundary validates with Zod
Use a `z.strictObject` schema from `lib/schemas/`, and write the **parsed** object — never the raw body.

```ts
const parsed = await parseBody(request, promptCreateSchema);
if (!parsed.ok) return parsed.response;
await createPrompt(guard.session, parsed.data);
```

### 5. Every admin route re-verifies the session
`proxy.ts` only checks whether a cookie *exists* — that is a redirect convenience, not a security boundary. Every admin API route calls `guardAdmin()` (origin + session + rate limit) and every admin page sits under the guarded `(panel)` layout, which calls `requireAdmin()`.

### 6. Files never pass through the server
Uploads go browser → presigned URL → R2. The server only signs the URL and afterwards verifies the object with a HEAD request. Never proxy file bytes through a route handler.

### 7. Public pages never read Firestore per request
Everything under `app/(public)/` is Static or SSG with `revalidate = 3600` plus on-demand `revalidateTag`. **Verify with `pnpm build`** — every public route must show `○` or `●`, never `ƒ`. This is the entire scaling strategy (PRD §17).

### 8. Never break the theme contract
No hardcoded hex in components. Use the semantic tokens (`bg-surface`, `text-fg-muted`, `border-border`, `text-accent`). Check both themes before calling anything done.

---

## Next.js 16 specifics

Things that differ from Next 15 and earlier, all of which this codebase depends on:

| Change | What it means here |
|---|---|
| `middleware.ts` → **`proxy.ts`** | Exported function is named `proxy`. Runs on the **Node runtime** (no edge), which is why Firebase-aware logic could live there if we wanted. |
| `revalidateTag(tag)` → **`revalidateTag(tag, profile)`** | Always pass a cacheLife profile. We use `"max"` — see `invalidate()` in `lib/firebase/mutations.ts`. |
| `updateTag(tag)` | Server-Actions only, read-your-writes. We use route handlers, so `revalidateTag` is correct for us. |
| `params` / `searchParams` are Promises | `const { slug } = await params`. |
| Typed routes are on | `Link href` and `router.push` only accept known routes. For a runtime-built href, cast via `Parameters<ReturnType<typeof useRouter>["replace"]>[0]` — see `browse-client.tsx`. |
| `next lint` removed | Use `pnpm lint` (eslint directly). `eslint` key in `next.config.ts` is gone too. |
| React Compiler stable | `reactCompiler: true`. Requires `babel-plugin-react-compiler` installed. It also brings lint rules — notably **no `setState` inside an effect**; derive during render or use `useSyncExternalStore` (`hooks/use-hydrated.ts`). |
| `images.domains` deprecated | Use `images.remotePatterns`. |
| Cache Components (`use cache`) | Available via `cacheComponents: true`. **We deliberately do not use it** — classic ISR is the stable path and matches our publish-driven invalidation. |

---

## Architecture

### Data flow

```
PUBLIC READ (static)                     ADMIN WRITE (dynamic)

Browser                                  Browser (admin)
   │ cached HTML from the edge              │ PATCH + session cookie
   ▼                                        ▼
Vercel/CDN ── hit ──► done               Route Handler
   │ miss / revalidate                      │ guardAdmin() → Zod parse
   ▼                                        ▼
RSC page (generateStaticParams)          firebase-admin (bypasses rules)
   │                                        │
   ▼                                        ▼
firebase-admin ──────────────────────►  Firestore
                                            │
                                            ▼
                                    revalidateTag(tag, "max") + audit log
```

### Directory map

```
app/(public)/…       Public routes. Static/SSG. Never read headers() here —
                     that would force dynamic rendering and kill the caching.
app/admin/login/     Unguarded (outside the (panel) group).
app/admin/(panel)/…  Guarded by layout.tsx → requireAdmin().
app/api/admin/…      All mutations. Each calls guardAdmin() itself.

lib/firebase/        client.ts (browser, read-only) · admin.ts ("server-only")
                     queries.ts (reads) · mutations.ts (writes + revalidation)
                     safe.ts (safeQuery — renders empty state if DB unreachable)
lib/auth/session.ts  Firebase Auth session cookies + requireAdmin()
lib/auth/access.ts   Access requests, roles, approve/reject (owner-gated)
lib/security/        rate-limit.ts · ssrf-guard.ts
lib/api/             guard.ts (the admin gate) · respond.ts (uniform responses)
lib/schemas/         Zod schemas. Domain types are inferred, never written twice.
lib/youtube/parse.ts Every YouTube URL form → 11-char ID
lib/utils/           slug.ts · clean-text.ts (OCR repair) · cn.ts
scripts/             extract-docx.ts · seed.ts · set-admin-claim.ts
```

### Server vs Client Components

Default to Server Components; add `"use client"` only for state, effects, browser APIs or handlers, and push it to the leaves.

Client islands: `CopyButton`, `PromptTextBlock`, `YouTubeEmbed`, `BrowseClient`, `SearchClient`, `SavedClient`, `BottomNav`, `ThemeToggle`, and everything in `components/admin/`.

---

## Security model

| Layer | Implementation |
|---|---|
| Admin auth | Firebase Auth (Google + email/password) → ID token → server-verified **HttpOnly** session cookie. `requireAdmin()` verifies with `checkRevoked: true` on every request. |
| Access requests | Anyone may sign in; that creates `users/{uid}` with `status: pending`. No cookie is issued until an owner approves. Rejection/suspension calls `revokeRefreshTokens`, which invalidates the live session cookie immediately. |
| Roles | `owner` (from `ADMIN_EMAILS`, or `pnpm set:admin`) → approves requests and edits settings. `admin` → manages content + settings. `editor` → content only. Mirrored onto custom claims, so `requireAdmin()` needs no Firestore read. |
| Escalation guards | Only `owner` can reach `/admin/users` or the API behind it. `decideAccess()` refuses to modify an owner record, and the decision payload is a `strictObject` so a client can't smuggle in a uid or email. |
| Firestore | Public read of published content only. **All client writes denied.** |
| CSRF | `SameSite=Strict` cookie + `sameOrigin()` Origin check on every mutation. |
| Rate limits | Upstash Redis, in-memory fallback in dev. Login 5/15min, uploads 30/10min, writes 120/5min. |
| Uploads | Presigned PUT with content-type **and** content-length locked into the signature. Random nanoid keys — never the uploaded filename. HEAD-verified after upload. |
| SSRF | `lib/security/ssrf-guard.ts` — HTTPS only, DNS resolution, private/loopback/link-local/CGNAT ranges blocked (incl. IPv4-mapped IPv6), no redirect following, size and time caps. |
| Headers | HSTS, nosniff, DENY framing, Referrer-Policy, Permissions-Policy. Admin adds `noindex` + `no-store`. |

### The split CSP — read before touching `proxy.ts`

A CSP nonce must be unique per request, so Next.js can only apply it while rendering **dynamically**. A site-wide nonce would disable static rendering, ISR and CDN caching — the whole scaling strategy. So:

- **`/admin/*` and `/api/admin/*`** → strict nonce CSP with `'strict-dynamic'`. Already dynamic and `no-store`, and the only surface with a session to protect.
- **Public routes** → static CSP with `script-src 'self' 'unsafe-inline'`, because React's streaming payload is injected inline.

`'unsafe-inline'` on public routes is an accepted trade-off: those pages carry no session, all content renders as text nodes, there is no user-generated content, and `object-src 'none'` / `base-uri 'self'` / `frame-ancestors 'none'` still apply. Setting a header in the proxy does **not** force dynamic rendering — only *reading* `headers()` in a page does.

---

## Key implementation notes

### Prompt text
Store plain text, preserve `\n`, never trim internal whitespace, never parse as Markdown. `lib/utils/clean-text.ts` repairs OCR artefacts from the source document (`com- mercial` → `commercial`, `rendering, rendering,` → `rendering,`) — it is **opt-in from the admin UI**, never silent, because a false positive would corrupt a prompt.

### YouTube
All parsing goes through `lib/youtube/parse.ts`. **`format` is stored, never inferred at render** — a Short is also reachable via a `watch?v=` URL, so the admin gets an Auto/Short/Video override and the choice is persisted. `short` → `9/16` capped at `min(80vh, 560px)`; `video` → `16/9`. Always render the façade first and mount the iframe only on click (~700 KB saved per embed). Always `youtube-nocookie.com`.

If a Short renders letterboxed, the `format` field on the document is wrong — fix the data, not the CSS.

### Cache tags
```ts
"prompts"              // any listing
`prompt:${slug}`       // one detail page
`category:${slug}`     // one category page
"settings" | "search-index"
```
Publishing invalidates only what changed. Renaming a slug or unpublishing invalidates **both** the old and new tags — otherwise a stale page survives at the edge.

### Media
Keys are `{scope}/{yyyy}/{MM}/{nanoid(12)}.{ext}`. Allowed: `image/jpeg|png|webp|avif` (plus sanitised SVG for logos only). Max 10 MB previews, 1 MB logos. Client downscales to 2400px, re-encodes to WebP, and generates the blur placeholder before upload.

---

## Design tokens

Defined in `app/globals.css` on `:root` / `.dark`, mapped into Tailwind via `@theme inline`.

`bg` · `surface` `surface-2` `surface-3` · `border` `border-strong` · `fg` `fg-muted` `fg-subtle` · `accent` `accent-hover` `accent-fg` `accent-soft` · `video` `image` · `success` `warning` `danger`

Custom utilities: `.container-page` · `.media-frame` · `.prompt-text` · `.rail-mask` · `.scrollbar-none` · `.safe-bottom`

**Dark-mode rules that are easy to get wrong:**
- Never pure black or pure white text — `oklch(0.158 …)` and `oklch(0.962 …)`.
- Elevation comes from lighter surfaces **plus borders**, not shadows (shadows are invisible on dark).
- The accent's lightness is *raised* in dark mode to hold AA contrast.
- Media gets a 1px inset light ring (`--media-ring`) so light-edged images don't bleed into the page.
- **Never dim images.** The media is the product.

---

## Gotchas

- **lucide-react v1 removed brand icons.** `Youtube`, `Twitter` etc. no longer exist — use `SquarePlay`, `Play`, etc. Check with `node -e "console.log(Object.keys(require('lucide-react')).includes('X'))"` before importing.
- **React Compiler lint bans `setState` in an effect.** Derive during render (the slug in `prompt-editor.tsx`) or use `useSyncExternalStore` (`use-hydrated.ts`, `use-saved.ts`).
- **`useSearchParams` needs a `<Suspense>` boundary** or prerendering fails. See `app/(public)/prompts/page.tsx`.
- **`useSyncExternalStore` must return a stable reference** from `getSnapshot`, or React loops forever. `use-saved.ts` caches on the raw string.
- **R2 CORS**: presigned PUT fails silently in the browser without a CORS rule allowing `PUT` from the origin. Check the bucket first when uploads fail with no error.
- **Firestore composite indexes**: any new filter combination needs an entry in `firestore.indexes.json`. The dev error links straight to the console — deploy the index, don't drop the filter.
- **`sharp` is a native dep** — keep it in `dependencies` and listed in `serverExternalPackages`.
- **pnpm build scripts** are opt-in via `allowBuilds` in `pnpm-workspace.yaml`. `sharp`, `protobufjs`, `esbuild` and `@firebase/util` all need it.

---

## Testing

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | `parseYouTube` (incl. host spoofing), `ssrfGuard` (incl. cloud metadata), `slugify`, `cleanPromptText`, `detectPlaceholders` |
| Rules | `@firebase/rules-unit-testing` | Draft reads denied · all client writes denied · published reads allowed |
| E2E | Playwright | browse → filter → detail → copy; admin sign-in → create → upload → publish |

`parseYouTube` and `ssrfGuard` are where bugs are both likely and expensive — test them properly.

---

## Definition of done

1. Works at 320 / 390 / 768 / 1024 / 1440px
2. Works in light **and** dark
3. Keyboard navigable with a visible focus ring
4. Loading, empty and error states implemented
5. `pnpm build` still shows public routes as `○`/`●`
6. Zod-validated at every API boundary
7. Tests for logic; E2E for the critical path
8. No new `console.log`, no new `any`
9. `pnpm check` passes

---

## Content notes

Source: `prompt-docs/AI Prompt Library .docx`. Run `pnpm extract:docx` to regenerate the JSON.

What the document actually contains — verified, not assumed:

- **93 `Prompt N` blocks, but only 58 unique prompts.** The tail is ~33 repeated copies of one template block, plus 2 genuine duplicates (the Snickers and Fanta prompts appear twice). The extractor fingerprints and skips them.
- **13 prompts are truncated in the source itself** at ~1024 characters, cut off mid-sentence. Verified by comparing extracted output against the raw `<w:p>` text — the document is truncated, not the extractor. They are flagged `likelyTruncated` and the seed writes a warning into `usageNotes`. **The full text must be pasted in manually before publishing those.**
- **All metadata placeholders are empty.** `Category • AI Tool • Date` is unfilled on every entry and both metadata tables are blank. Categorisation and tool attribution are manual admin work.
- **The 59 embedded images are unusable** — Instagram screenshots with phone status bars, comment bars and an `@actionables.ai` watermark, plus captures of other prompt sites. Fresh preview media must be uploaded.

Content is ~85% video, heavily skewed to `9:16`. **Design and test for vertical media first.**
