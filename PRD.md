# STS Prompt Library — Product Requirements Document

**AI Image & Video Prompt Library**

| | |
|---|---|
| **Version** | 1.1 |
| **Date** | 7 August 2026 (rev. 1.1 — decisions locked, build started) |
| **Owner** | Taufik Razvi · Skills To Salary |
| **Status** | In build — M0–M3 complete |
| **Source material** | `prompt-docs/AI Prompt Library .docx` — 60 unique prompts, 59 preview images |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Source Content Analysis](#2-source-content-analysis)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Personas & User Stories](#4-personas--user-stories)
5. [Competitive Research](#5-competitive-research)
6. [Scope](#6-scope)
7. [Information Architecture](#7-information-architecture)
8. [Data Model](#8-data-model)
9. [Design System](#9-design-system)
10. [Screen Specifications — Public](#10-screen-specifications--public)
11. [Screen Specifications — Admin](#11-screen-specifications--admin)
12. [Media Pipeline (Cloudflare R2 + YouTube)](#12-media-pipeline-cloudflare-r2--youtube)
13. [Search Architecture](#13-search-architecture)
14. [PWA Specification](#14-pwa-specification)
15. [Theming — Dark & Light](#15-theming--dark--light)
16. [Security Specification](#16-security-specification)
17. [Performance & Scale](#17-performance--scale)
18. [SEO & Sharing](#18-seo--sharing)
19. [Accessibility](#19-accessibility)
20. [Analytics](#20-analytics)
21. [Tech Stack](#21-tech-stack)
22. [Environment Variables](#22-environment-variables)
23. [Delivery Milestones](#23-delivery-milestones)
24. [Open Decisions & Assumptions](#24-open-decisions--assumptions)
25. [Out of Scope / Future](#25-out-of-scope--future)

---

## 1. Executive Summary

**STS Prompt Library** is a public, open-access web library of high-quality AI **image** and **video** prompts. Anyone can browse, search, filter, preview and one-tap copy a prompt. A private **Admin Panel** lets the owner add, edit, organise and publish prompts, upload preview media, manage categories, and brand the site (logo, colours, SEO).

**The core value proposition:** every prompt is shown *next to the result it produces*. A prompt without its output is just text; a prompt with a preview is proof. This is the single design principle the whole product hangs on.

### The one-line pitch
> *A beautifully designed, installable library of battle-tested AI image and video prompts — each one paired with the exact output it generates.*

### Three product pillars

| Pillar | What it means |
|---|---|
| **Preview-first** | The grid is a media gallery, not a text list. Image previews and YouTube video previews are first-class citizens. |
| **Copy in one tap** | Zero friction from "I like this" → "it's in my clipboard". No login, no paywall, no modal. |
| **Installable** | Full PWA. Users add it to their home screen and it behaves like a native app, including offline access to previously viewed prompts. |

### Key technical choices at a glance

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript | ISR/SSG means Firestore reads don't scale with traffic |
| Package manager | **pnpm** | Fast, disk-efficient, strict dependency resolution, reproducible CI |
| Database | **Firebase Firestore** | Requested; excellent for this read-heavy, low-write shape |
| Media storage | **Cloudflare R2** | Requested; S3-compatible, **zero egress fees**, CDN at the edge |
| Video previews | YouTube embed (Shorts + full) | No video hosting bill, no transcoding, instant global playback |
| PWA | **Serwist** (`@serwist/next`) | Actively maintained successor to `next-pwa` |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) | Token-driven theming, accessible primitives |
| Search | Prebuilt static JSON index + MiniSearch (client-side) | Instant, zero Firestore reads, works offline |
| Hosting | Vercel | Native ISR + on-demand revalidation + edge network |

> **Note on "pnpm so it can support high users":** pnpm is the *package manager* — it makes installs fast and builds reproducible, but it does not affect how many visitors the site can serve. Traffic capacity comes from the caching architecture in [§17](#17-performance--scale): static pages at the edge, media on R2's CDN, and a search index that never touches the database. Both are delivered.

---

## 2. Source Content Analysis

The supplied `.docx` was unpacked and analysed. Findings below drive the data model and category taxonomy.

### 2.1 Structure of each entry

Every prompt in the document follows a repeating template:

```
Prompt {N}
Category • AI Tool • Date          ← placeholder metadata, never filled in
Preview   [embedded screenshot]
## Prompt ❐  {the prompt body}
[optional table: AI TOOL | MODEL | ASPECT RATIO | NOTES]
```

**Volume — verified by running the extractor, not estimated:** 93 `Prompt N` blocks, resolving to **58 unique prompts**. The tail is ~33 repeated copies of a single template block, plus 2 genuine duplicates (the Snickers and Fanta prompts each appear twice). The extractor fingerprints the first 200 characters and skips repeats.

**⚠ 13 prompts are truncated in the source document itself**, cut off mid-sentence at ~1,024 characters. This was verified by comparing extracted output against the raw `<w:p>` paragraph text — the lengths match exactly, so the `.docx` is truncated, not the extraction. They are flagged `likelyTruncated` in the JSON and the seed writes a warning into `usageNotes`. **The full text must be pasted in manually before those can be published.**

**Media:** 59 embedded PNGs in `word/media/`. Inspection shows these are **screenshots**, not clean assets — Instagram post captures (visible status bar, "Add comment…" bar, `@actionables.ai` watermark) and captures of other prompt-library sites (e.g. a YouMind "Seedance-2.5" page). They establish provenance but are **not usable as production previews**. Fresh preview media must be uploaded through the admin panel.

**Metadata quality:** The `Category • AI Tool • Date` line is an unfilled placeholder on all 60 entries, and the `AI TOOL / MODEL / ASPECT RATIO / NOTES` table appears only twice, both empty. **Therefore all categorisation, tool attribution and metadata must be entered manually via the admin panel.** The importer's job is to get the prompt *text* in cleanly; a human classifies afterwards.

### 2.2 Content characteristics

| Attribute | Observation | Product implication |
|---|---|---|
| **Type mix** | ~85% video prompts, ~15% image/storyboard prompts | Video preview support is not a nice-to-have — it is the primary case |
| **Length** | 40 → 4,200 characters. Prompt 12 is a single 4,200-char paragraph | Detail page needs collapse/expand, a scroll container, and a monospace reading mode |
| **Formatting** | Heavy use of timestamps (`0-4s:`, `[00:00-00:02]`), section headers (`STYLE`, `CAMERA`, `AUDIO NOTES`), shot labels (`[Medium Wide]`, `[Slow 360° Orbital]`), bracket tokens (`【Duration】`) | Store as **plain text with newlines preserved**. Render in `<pre>`-style monospace with `white-space: pre-wrap`. Never parse as Markdown — the `[]` and `**` characters are content, not syntax |
| **Placeholders** | `[Product Name]`, `{product type)`, `@Image1`, `[@0]` | Add a `hasPlaceholders` flag + a "Template" badge so users know they must substitute values |
| **Negative prompts** | Present as an explicit `Negative Prompt:` section in several entries | Dedicated `negativePrompt` field with its own copy button |
| **Aspect ratios** | `9:16` dominant (vertical/Shorts), then `16:9`, some `1:1` | Grid must handle portrait media gracefully → **masonry layout, not fixed-ratio tiles** |
| **Durations** | 5s, 8s, 10s, 12s, 15s, 24s, 30s | `duration` filter facet |
| **OCR noise** | Word-doubling from image OCR (`rendering, rendering,`, `consistent consistent`, `cutting cutting`), hyphen breaks (`com- mercial`, `specu-lar`) | Importer runs a de-hyphenation + duplicate-word cleanup pass; admin reviews before publishing |
| **Reference-image dependency** | Many prompts say "use the uploaded product image", "@Image1", "first reference image" | `requiresReferenceImage: boolean` flag + badge, so users aren't confused |

### 2.3 Derived taxonomy

Categories inferred from actual content, with observed counts:

| Category | Slug | Approx. count | Representative prompts |
|---|---|---|---|
| Product Ads & Commercials | `product-ads` | ~24 | Snickers, Fanta, 7UP Litchi, KitKat, Magnum, Cornetto, Colgate Kids, Rooh Afza, Garnier Men, ZERO earbuds |
| Cinematic Film | `cinematic` | ~9 | Desert SUV jump, 1950s diner time-freeze, roller-coaster wig, cyberpunk card storm |
| UGC & Vlog Style | `ugc-vlog` | ~6 | Mini-DV coffee vlog, handheld laundry montage, travel vlog |
| Food & Beverage | `food-beverage` | ~7 | Perfect hot dog, Japanese farmhouse dinner, riverside forest picnic, mango pickle |
| Fashion & Beauty | `fashion-beauty` | ~5 | Mojave luxury fashion film, FPV shoe orbit, hyaluronic serum, mango beauty ad |
| Character & Consistency | `character-consistency` | ~5 | Paparazzi CEO, Barbie giant hands, identity-locked travel vlog |
| Animation & Anime | `animation` | ~4 | 2D anime sticker composite, chibi baby archaeologist, animated forest picnic |
| VFX & Hypermotion | `vfx-hypermotion` | ~4 | Hypermotion product vortex, lava-world Chester Cheetah |
| Storyboards | `storyboards` | ~3 | Parle-G 3×3 board, 6-image luxury ad set |
| Lifestyle & Travel | `lifestyle-travel` | ~2 | Seaside travel day, city golden-hour romance |
| Interior & Architecture | `interior-architecture` | ~2 | Room self-assembly, modern house timelapse |

### 2.4 AI tools to seed

Seed the `aiTool` picker with: **Veo 3.1, Veo 3, Sora 2, Kling 2.5, Runway Gen-4, Hailuo / MiniMax, Seedance 2.5, Grok Imagine, Higgsfield, Midjourney v7, Nano Banana (Gemini), Flux 1.1** — plus a free-text "Other" so new models can be added without a code change.

---

## 3. Goals & Success Metrics

### 3.1 Product goals

| # | Goal |
|---|---|
| G1 | Publish all 60 source prompts with clean text, correct categories and real preview media |
| G2 | Make copying a prompt effortless — ≤ 2 taps from any screen |
| G3 | Make the library feel like a *gallery*, so the preview sells the prompt |
| G4 | Give the owner a fast admin panel — adding a prompt takes under 90 seconds |
| G5 | Ship an installable PWA that works on a phone home screen and offline |
| G6 | Serve high traffic on near-zero infrastructure cost |

### 3.2 Success metrics

| Metric | Target |
|---|---|
| Copy-to-view ratio | > 25% of prompt detail views end in a copy |
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse PWA / Best Practices / SEO / A11y | ≥ 95 each |
| Largest Contentful Paint (mobile, p75) | < 2.0s |
| Interaction to Next Paint (p75) | < 200ms |
| Time to add a prompt in admin | < 90 seconds |
| Firestore reads per 1,000 public page views | < 10 (cached/static serving) |
| PWA install rate | > 3% of returning visitors |

### 3.3 Non-goals for v1

User accounts, prompt submissions from the public, comments, ratings, payments, AI generation inside the app, a REST API for third parties.

---

## 4. Personas & User Stories

### 4.1 Personas

**Aarav — Content Creator (primary, ~65%)**
Makes Reels/Shorts. On a phone, usually in bed or between shoots. Wants a prompt that already works, copied straight into Veo or Sora. Will not read a manual. Bounces if a page takes 4 seconds.
*Needs:* fast mobile browsing, big previews, one-tap copy, filter by tool.

**Meera — Brand / Agency Marketer (~25%)**
Building a product commercial for a client. On a laptop. Needs prompts she can adapt — placeholders are a feature, not a bug. Wants to filter to `Product Ads` + `9:16` + `Veo 3.1`.
*Needs:* precise filters, full prompt text visible, template markers, an obvious way to save for later.

**Taufik — Owner / Admin (1 user)**
Adds 5–15 prompts a week from his phone or laptop. Wants the fewest possible fields, drag-drop image upload, and paste-a-YouTube-URL video previews.
*Needs:* fast editor, autosave drafts, bulk import, media library, one-switch publish.

### 4.2 User stories

**Discovery**
- As a visitor, I land on the home page and immediately see a wall of real AI outputs, so I understand what this site is within 2 seconds.
- As a visitor, I can toggle between *Images* and *Videos* with a single control.
- As a visitor, I can browse by category from a horizontally scrollable chip rail on mobile.
- As a visitor, I can search by keyword and get results as I type, with no page reload.
- As a visitor, I can filter by AI tool, aspect ratio, duration and type, and combine those filters.
- As a visitor, I can sort by Newest, Most Copied, or Featured.

**Consumption**
- As a visitor, I open a prompt and see the preview media large and the full prompt text below it.
- As a visitor, I tap **Copy Prompt** and get a confirmation toast; the button state changes to "Copied".
- As a visitor, I can copy the negative prompt separately.
- As a visitor, I can play a YouTube preview inline without leaving the page.
- As a visitor viewing a Short, the player is vertical (9:16) and not letterboxed into a 16:9 box.
- As a visitor, I can see which AI tool, model, aspect ratio and duration the prompt was made for.
- As a visitor, I can see related prompts from the same category at the bottom.
- As a visitor, I can share a prompt via the native share sheet.

**Retention**
- As a visitor, I can save a prompt to a local Favourites list without creating an account.
- As a visitor, I am prompted to install the app after my second visit.
- As an installed user, I can open the app offline and still read prompts I have already viewed.

**Admin**
- As the admin, I sign into a protected panel with a passcode.
- As the admin, I create a prompt with title, description, body, type, category, tags and metadata.
- As the admin, I upload a preview image by drag-drop, or paste an external image URL.
- As the admin, I paste any YouTube URL — Shorts or full — and the system extracts the ID, detects the format, and renders the right player.
- As the admin, I save as Draft, preview it exactly as the public will see it, then Publish.
- As the admin, I manage categories: name, slug, description, colour, icon, cover image, sort order.
- As the admin, I upload light-mode and dark-mode logos, plus a favicon and OG image.
- As the admin, I bulk-import prompts from a JSON/CSV file.
- As the admin, I reorder featured prompts by drag and drop.
- As the admin, I see view and copy counts per prompt.

---

## 5. Competitive Research

| Product | What it does well | What we take | What we avoid |
|---|---|---|---|
| **PromptHero** | Every prompt shown with its resulting image; dense masonry gallery | Preview-first masonry as the core layout | Cluttered nav, aggressive upsell |
| **Lexica** | Extremely fast, minimal, search-forward | Instant client-side search, restrained chrome | Almost no metadata or filtering |
| **FlowGPT** | Huge community volume, trending feeds | "Most copied" sort as light social proof | Login walls, social noise, low quality bar |
| **AIPRM** | Clean taxonomy, professional tone | Structured category + tool facets | Extension dependency, paywalled tiers |
| **PromptBase** | Strong per-prompt detail pages, clear licensing | Detail page anatomy: preview → meta strip → prompt block → related | Marketplace friction, checkout |
| **YouMind** *(seen in source doc)* | Very clean prompt detail: hero preview, description, then a distinctly-styled copy block | Monospace prompt card with a floating copy button | Sign-in gate on browse |

**Synthesis — what makes STS Prompt Library different:**
1. **Video previews are native.** Competitors are overwhelmingly still-image libraries. Our content is 85% video, so an inline YouTube player (correctly handling vertical Shorts) is a genuine differentiator.
2. **No account, ever, to consume.** Every competitor eventually gates something. We do not.
3. **Installable.** None of the above ship a real PWA. "Add to Home Screen" turns a bookmark into an app icon.
4. **Curated, not crowdsourced.** A tight, hand-verified set beats 10 million unranked prompts.

---

## 6. Scope

### 6.1 In scope — v1.0

| Area | Included |
|---|---|
| Public site | Home, Browse, Category, Prompt Detail, Search, Favourites, About, 404, Offline |
| Admin | Passcode login, Dashboard, Prompt list, Prompt editor, Categories, Tags, Media library, Site settings, Import, Analytics |
| Media | R2 direct upload (presigned), external image URL, YouTube Shorts + full video |
| Theming | System / Light / Dark with no flash-of-wrong-theme |
| Branding | Admin-uploadable light logo, dark logo, favicon, OG image, accent colour |
| PWA | Manifest, service worker, offline shell, install prompt, iOS instructions, app shortcuts |
| Security | Admin gate, hardened Firestore rules, CSP, rate limits, upload validation, SSRF guards |
| i18n-ready | Copy centralised in one module; English only shipped |

### 6.2 Explicitly deferred

Public user accounts, prompt submissions, comments/likes, collections/boards shared by URL, paid tiers, a public API, multi-admin roles, prompt versioning history, AI-assisted prompt generation.

---

## 7. Information Architecture

### 7.1 Route map

```
PUBLIC
/                              Home — hero, featured rail, category rail, latest grid
/prompts                       Browse all + full filter panel
/prompts?type=video            Deep-linkable filter state (all filters are URL params)
/prompts/[slug]                Prompt detail
/categories                    All categories grid
/categories/[slug]             Single category listing
/search                        Full search page (also available as ⌘K overlay)
/saved                         Local favourites (IndexedDB, no account)
/about                         Static page
/offline                       PWA offline fallback
/not-found                     404

ADMIN  (all under middleware protection)
/admin/login                   Passcode entry
/admin                         Dashboard
/admin/prompts                 Table: search, filter, bulk actions
/admin/prompts/new             Editor — create
/admin/prompts/[id]            Editor — edit
/admin/prompts/[id]/preview    Renders exactly as public detail page
/admin/categories              CRUD + drag-reorder
/admin/tags                    CRUD + merge
/admin/media                   R2 media library
/admin/settings                Branding, SEO, theme defaults
/admin/import                  Bulk JSON/CSV import with mapping + dry-run
/admin/analytics               Views, copies, top prompts

API  (Route Handlers)
POST   /api/admin/login              Passcode → signed session cookie
POST   /api/admin/logout
POST   /api/admin/upload-url         Issue presigned R2 PUT
POST   /api/admin/upload-complete    Verify + register asset
POST   /api/admin/prompts            Create
PATCH  /api/admin/prompts/[id]       Update
DELETE /api/admin/prompts/[id]       Delete
POST   /api/admin/revalidate         On-demand ISR revalidation
POST   /api/admin/import             Bulk import (dry-run + commit)
GET    /api/search-index             Cached static search index JSON
POST   /api/metric                   Rate-limited view/copy counter beacon
GET    /api/og/[slug]                Dynamic Open Graph image
GET    /api/image-proxy              SSRF-guarded external image proxy
```

### 7.2 Navigation

**Desktop header (sticky, 64px, blurred backdrop)**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [LOGO]   Browse  Categories  Saved        [ ⌘K Search… ]  [☀/☾]  [⬇ App] │
└──────────────────────────────────────────────────────────────────────────┘
```

**Mobile:** 56px header with logo + search icon + theme toggle, and a **bottom tab bar** — the correct pattern for a PWA that lives on a home screen.

```
┌──────────────────────────────────────────┐
│  [LOGO]                    [🔍]    [☾]   │
└──────────────────────────────────────────┘
                  … content …
┌──────────────────────────────────────────┐
│   ⌂        ▦         🔍       ♡          │
│  Home   Browse    Search   Saved         │
└──────────────────────────────────────────┘
```
Bottom bar respects `env(safe-area-inset-bottom)`. It hides on downward scroll, reappears on upward scroll.

---

## 8. Data Model

Firestore, four primary collections plus a settings singleton.

### 8.1 `prompts/{promptId}`

```ts
type Prompt = {
  id: string;                    // Firestore doc ID (nanoid, 12 chars)
  slug: string;                  // unique, URL-safe, e.g. "cinematic-desert-suv-jump"

  // Content
  title: string;                 // 3–90 chars
  description: string;           // 0–280 chars — shown on card + meta description
  promptText: string;            // the prompt itself; newlines preserved; 1–20,000 chars
  negativePrompt?: string;       // 0–2,000 chars
  usageNotes?: string;           // "Upload a product photo as reference first"

  // Classification
  type: 'image' | 'video';
  categoryId: string;            // primary category (1:1 — keeps filters simple)
  categorySlug: string;          // denormalised for query-free rendering
  tags: string[];                // max 8, lowercase-kebab

  // Generation metadata
  aiTool: string;                // "Veo 3.1"
  model?: string;                // "veo-3.1-fast"
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5' | '21:9' | '3:2';
  durationSeconds?: number;      // video only
  requiresReferenceImage: boolean;
  hasPlaceholders: boolean;      // contains [Product Name] style tokens

  // Preview media
  preview: PreviewMedia;
  gallery?: PreviewMedia[];      // max 6 extra stills

  // Optional credit for where the prompt came from
  attribution?: { source?: string; handle?: string; url?: string };

  // Publishing
  status: 'draft' | 'published';
  featured: boolean;
  featuredOrder?: number;
  publishedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Search + stats
  searchTokens: string[];        // lowercased tokens, capped at 120 (Firestore fallback search)
  stats: { views: number; copies: number; saves: number };

  // SEO overrides (optional)
  seo?: { title?: string; description?: string; ogImageUrl?: string };
};

type PreviewMedia =
  | {
      kind: 'image';
      url: string;               // R2 public URL or validated external URL
      r2Key?: string;            // present when we own the object (needed for deletion)
      source: 'upload' | 'url';
      width: number;
      height: number;
      blurDataURL: string;       // base64 LQIP, ~20 chars wide, generated at upload
      alt: string;               // required — accessibility
      bytes?: number;
      mime?: string;
    }
  | {
      kind: 'youtube';
      youtubeId: string;         // exactly 11 chars, /^[A-Za-z0-9_-]{11}$/
      format: 'short' | 'video'; // drives player aspect ratio
      originalUrl: string;       // what the admin pasted, kept for reference
      title?: string;            // fetched via oEmbed at save time
      thumbnailUrl: string;      // https://i.ytimg.com/vi/{id}/maxresdefault.jpg
      startSeconds?: number;
    };
```

**Field rationale**
- `categorySlug` is denormalised so a prompt card renders its category label with **zero extra reads**.
- `blurDataURL` powers `next/image` placeholder blur — removes layout jank on a masonry grid.
- `format: 'short' | 'video'` is stored, not inferred at render, so the player never guesses wrong.
- `stats` is embedded rather than a subcollection because it is written by an aggregator, not per-request.

### 8.2 `categories/{categoryId}`

```ts
type Category = {
  id: string;
  slug: string;             // unique
  name: string;             // "Product Ads & Commercials"
  description: string;      // 0–200 chars, shown on the category page
  icon: string;             // lucide icon name, e.g. "package"
  accentColor: string;      // OKLCH string, used for the chip + category hero
  coverImage?: PreviewMedia;
  order: number;            // manual sort
  promptCount: number;      // denormalised, recomputed on publish/unpublish
  isVisible: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

### 8.3 `tags/{tagId}`

```ts
type Tag = {
  id: string;
  slug: string;        // "slow-motion"
  label: string;       // "Slow Motion"
  count: number;
  createdAt: Timestamp;
};
```
Tags are a flat, admin-curated vocabulary. A merge action reassigns a tag across all prompts and deletes the source.

### 8.4 `settings/site` (singleton document)

```ts
type SiteSettings = {
  siteName: string;                    // "STS Prompt Library"
  tagline: string;
  description: string;                 // default meta description

  branding: {
    logoLight?: PreviewMedia;          // shown ON light backgrounds (dark ink)
    logoDark?: PreviewMedia;           // shown ON dark backgrounds (light ink)
    logoMark?: PreviewMedia;           // square mark for mobile / PWA icon source
    favicon?: PreviewMedia;
    ogImage?: PreviewMedia;
    accentColor: string;               // OKLCH — overrides the default violet
  };

  seo: {
    titleTemplate: string;             // "%s · STS Prompt Library"
    defaultOgImageUrl?: string;
    twitterHandle?: string;
    canonicalHost: string;
  };

  ui: {
    defaultTheme: 'system' | 'light' | 'dark';
    showAnnouncement: boolean;
    announcementText?: string;
    announcementHref?: string;
    homeHeroHeadline: string;
    homeHeroSubline: string;
  };

  social: { instagram?: string; youtube?: string; x?: string; email?: string };
  updatedAt: Timestamp;
};
```

### 8.5 `media/{mediaId}` — R2 asset registry

```ts
type MediaAsset = {
  id: string;
  r2Key: string;              // "prompts/2026/08/a7Kd93nQ.webp"
  url: string;                // https://cdn.stsprompts.com/prompts/2026/08/a7Kd93nQ.webp
  mime: string;
  bytes: number;
  width: number;
  height: number;
  blurDataURL: string;
  originalName: string;       // sanitised, display only — never used in the key
  usedBy: string[];           // prompt IDs referencing it — blocks orphan deletion
  uploadedAt: Timestamp;
};
```

### 8.6 Indexes required

| Collection | Fields | Purpose |
|---|---|---|
| `prompts` | `status ASC, publishedAt DESC` | Latest published feed |
| `prompts` | `status ASC, type ASC, publishedAt DESC` | Image/Video tab |
| `prompts` | `status ASC, categorySlug ASC, publishedAt DESC` | Category listing |
| `prompts` | `status ASC, featured ASC, featuredOrder ASC` | Featured rail |
| `prompts` | `status ASC, stats.copies DESC` | "Most copied" sort |
| `prompts` | `status ASC, aiTool ASC, publishedAt DESC` | Tool filter |
| `prompts` | `slug ASC` | Slug lookup (unique) |
| `categories` | `isVisible ASC, order ASC` | Nav + category grid |

### 8.7 Slug generation

`slugify(title)` → lowercase, strip diacritics, non-alphanumerics → `-`, collapse repeats, trim, cap at 60 chars. On collision append `-2`, `-3`… Slugs are **immutable after publish**; if the admin changes one, write the old slug into a `redirects/{oldSlug}` doc and 301 from it.

---

## 9. Design System

### 9.1 Design direction

**"Editorial Gallery."** The interface is a quiet frame around loud content. AI-generated media is saturated and busy, so the chrome is near-monochrome with a single accent. Generous whitespace, confident type, and a subtle grain/noise texture on large dark surfaces to stop them looking flat. The prompt text block is the one deliberately *technical* element — monospace, boxed, obviously copyable.

**Feels like:** a well-art-directed film-stills archive.
**Not:** a SaaS dashboard, and not a neon "AI" cliché.

### 9.2 Colour tokens

All colours in **OKLCH** for perceptually even lightness ramps. Defined as CSS custom properties on `:root`, overridden under `.dark`.

**Light theme**
```css
:root {
  --bg:              oklch(0.993 0.003 286);   /* page */
  --surface:         oklch(1.000 0.000 0);     /* cards */
  --surface-2:       oklch(0.972 0.004 286);   /* insets, prompt block */
  --surface-3:       oklch(0.948 0.006 286);   /* hover */
  --border:          oklch(0.912 0.006 286);
  --border-strong:   oklch(0.848 0.008 286);

  --text:            oklch(0.205 0.014 286);
  --text-muted:      oklch(0.520 0.012 286);
  --text-subtle:     oklch(0.652 0.010 286);

  --accent:          oklch(0.548 0.216 286);   /* violet */
  --accent-hover:    oklch(0.498 0.222 286);
  --accent-fg:       oklch(0.995 0.000 0);
  --accent-soft:     oklch(0.955 0.030 286);   /* tinted chip bg */

  --video:           oklch(0.560 0.210 320);   /* magenta — video badge */
  --image:           oklch(0.600 0.135 210);   /* cyan  — image badge */

  --success:         oklch(0.596 0.145 155);
  --warning:         oklch(0.720 0.160 75);
  --danger:          oklch(0.578 0.215 25);

  --overlay:         oklch(0.205 0.014 286 / 0.45);
  --shadow-color:    286 12% 20%;
}
```

**Dark theme**
```css
.dark {
  --bg:              oklch(0.158 0.012 286);
  --surface:         oklch(0.198 0.014 286);
  --surface-2:       oklch(0.238 0.015 286);
  --surface-3:       oklch(0.278 0.016 286);
  --border:          oklch(0.302 0.016 286);
  --border-strong:   oklch(0.382 0.018 286);

  --text:            oklch(0.962 0.004 286);
  --text-muted:      oklch(0.688 0.012 286);
  --text-subtle:     oklch(0.552 0.012 286);

  --accent:          oklch(0.712 0.185 286);
  --accent-hover:    oklch(0.762 0.180 286);
  --accent-fg:       oklch(0.158 0.012 286);
  --accent-soft:     oklch(0.288 0.070 286);

  --video:           oklch(0.720 0.180 320);
  --image:           oklch(0.740 0.120 210);

  --success:         oklch(0.720 0.150 155);
  --warning:         oklch(0.800 0.150 75);
  --danger:          oklch(0.680 0.190 25);

  --overlay:         oklch(0.100 0.010 286 / 0.65);
  --shadow-color:    286 30% 3%;
}
```

**Contrast verification:** every text token against its intended background exceeds **WCAG AA 4.5:1** for body and **3:1** for large text. `--text-subtle` is reserved for decorative/non-essential labels only.

**Admin accent override:** `settings.branding.accentColor` is injected as an inline `<style>` on `<html>` overriding `--accent`. Hover and soft variants are derived by adjusting L in OKLCH, so one input recolours the whole system coherently.

### 9.3 Typography

| Role | Family | Notes |
|---|---|---|
| UI + headings | **Geist Sans** (`next/font/local`, variable) | Tight tracking on display sizes |
| Prompt text + code | **JetBrains Mono** (variable) | `font-variant-ligatures: none` |

Self-hosted via `next/font` — no third-party font request, which also keeps the CSP tight.

**Type scale** (fluid via `clamp()`)

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `display` | `clamp(2.25rem, 6vw, 4rem)` | 1.05 | 600 | Home hero |
| `h1` | `clamp(1.75rem, 4vw, 2.5rem)` | 1.15 | 600 | Prompt title |
| `h2` | `1.5rem` | 1.25 | 600 | Section headers |
| `h3` | `1.125rem` | 1.35 | 600 | Card titles |
| `body` | `0.9375rem` | 1.6 | 400 | Descriptions |
| `body-sm` | `0.875rem` | 1.55 | 400 | Meta |
| `caption` | `0.75rem` | 1.4 | 500 | Badges, labels |
| `mono` | `0.875rem` | **1.75** | 400 | Prompt body — extra leading for long text |

### 9.4 Spacing, radius, elevation, motion

- **Spacing:** 4px base — `0.5 1 1.5 2 3 4 6 8 12 16 24` (×4px).
- **Radius:** `sm 6px` · `md 10px` · `lg 14px` · `xl 20px` · `2xl 28px` · `full`. Cards use `lg`; media wrappers `xl`; sheets `2xl` on top corners only.
- **Elevation:** four levels, tinted with `--shadow-color`. In dark mode shadows are weak; **borders carry the separation instead** — a critical detail most dark themes get wrong.
- **Motion:** `fast 120ms` · `base 180ms` · `slow 280ms` · `slower 420ms`, easing `cubic-bezier(0.32, 0.72, 0, 1)`. Everything wrapped in `@media (prefers-reduced-motion: reduce)` → duration `0.01ms`.

### 9.5 Component inventory

| Component | Notes |
|---|---|
| `PromptCard` | Masonry tile. Media + gradient scrim + title + type badge + tool chip. Hover: scale 1.02, quick-copy button fades in |
| `MasonryGrid` | CSS `columns` on mobile, JS-measured absolute layout ≥ md for correct ordering |
| `TypeBadge` | Image (cyan) / Video (magenta) pill with icon |
| `CopyButton` | 3 states: idle → copying → copied (2s). Uses `navigator.clipboard` with a `execCommand` fallback |
| `PromptTextBlock` | Monospace, `white-space: pre-wrap`, max-height 480px collapsed with a fade + "Show full prompt" |
| `YouTubeEmbed` | Lazy façade: thumbnail + play button; the iframe mounts only on click |
| `MediaFrame` | Aspect-ratio-locked wrapper with skeleton + blur placeholder |
| `FilterBar` | Desktop: sticky sidebar. Mobile: bottom sheet triggered by a Filters button showing an active-count badge |
| `ChipRail` | Horizontally scrollable, snap points, edge fade masks |
| `SearchOverlay` | ⌘K / Ctrl-K, keyboard navigable, grouped results, recent searches |
| `ThemeToggle` | 3-way segmented: System / Light / Dark |
| `InstallPrompt` | Bottom sheet; Android uses `beforeinstallprompt`, iOS shows illustrated Share → Add to Home Screen |
| `EmptyState` | Illustration + headline + primary action |
| `Skeleton` | Shimmer respecting reduced-motion |
| `Toast` | Bottom-centre on mobile, bottom-right on desktop; auto-dismiss 3s |
| `AdminShell` | Sidebar + topbar; collapses to a drawer under lg |
| `Dropzone` | Drag-drop with paste support, progress ring, and an inline error state |

### 9.6 Breakpoints & grid

| Name | Min width | Grid columns | Gutter |
|---|---|---|---|
| `xs` | 0 | 1 | 12px |
| `sm` | 480 | 2 | 14px |
| `md` | 768 | 2 | 16px |
| `lg` | 1024 | 3 | 20px |
| `xl` | 1280 | 4 | 24px |
| `2xl` | 1536 | 4 (max container 1440px) | 24px |

**Mobile-first is not a slogan here** — the primary persona is on a phone. Every screen below is specified at 390px first, then scaled up.

---

## 10. Screen Specifications — Public

### 10.1 Home `/`

**Purpose:** prove the value of the library in the first viewport.

**Mobile wireframe (390px)**
```
┌────────────────────────────────────────┐
│ [LOGO]                    🔍       ☾   │  56px sticky, blur backdrop
├────────────────────────────────────────┤
│                                        │
│   1,000+ AI prompts that               │  display type
│   actually work.                       │
│                                        │
│   Copy-ready image and video prompts,   │  body, --text-muted
│   each shown with its real output.     │
│                                        │
│   ┌──────────────────────────────────┐ │
│   │ 🔍  Search prompts…              │ │  tap → SearchOverlay
│   └──────────────────────────────────┘ │
│                                        │
│   [ All ] [ 🖼 Images ] [ 🎬 Videos ]   │  segmented, sticky on scroll
├────────────────────────────────────────┤
│  Featured                    See all → │
│  ┌────────┐┌────────┐┌────────┐        │
│  │  9:16  ││  9:16  ││  16:9  │ ▸      │  snap-scroll rail
│  │ media  ││ media  ││ media  │        │
│  │ ▶      ││        ││ ▶      │        │
│  │ Title  ││ Title  ││ Title  │        │
│  └────────┘└────────┘└────────┘        │
├────────────────────────────────────────┤
│  Browse by category                    │
│  [📦 Product Ads] [🎬 Cinematic] ▸      │  chip rail
│  [📱 UGC] [🍔 Food] [👗 Fashion]        │
├────────────────────────────────────────┤
│  Latest prompts                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │  masonry, 1 col @ xs
│  │        preview media             │  │  2 col @ sm
│  │                          [🎬]    │  │
│  │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁    │  │  gradient scrim
│  │  Cinematic Desert SUV Jump       │  │
│  │  Veo 3.1 · 9:16 · 10s      [⧉]  │  │  ⧉ = quick copy
│  └──────────────────────────────────┘  │
│              … more …                  │
│         [ Load more ]                  │  intersection-observer autoload
├────────────────────────────────────────┤
│   ⌂      ▦      🔍      ♡              │  bottom tab bar
└────────────────────────────────────────┘
```

**Desktop (≥1280px):** hero becomes a two-column split — copy left, a slowly auto-advancing 3-tile preview collage right. Featured rail becomes a 4-up grid. Latest becomes 4-column masonry.

**Behaviour**
- Hero headline/subline come from `settings.ui` so the admin can edit them.
- Featured rail = `featured == true`, ordered by `featuredOrder`, capped at 12.
- Latest grid: 24 items server-rendered, then infinite scroll in pages of 24.
- The Image/Video segmented control writes `?type=` and soft-navigates without a full reload.
- Announcement bar renders above the header when `settings.ui.showAnnouncement`.

**Data:** fully static (ISR, `revalidate: 3600` + on-demand tag invalidation on publish).

---

### 10.2 Browse `/prompts`

**Purpose:** the power-user surface. Every filter is a URL parameter, so any view is shareable.

**Desktop wireframe (1440px)**
```
┌───────────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Browse  Categories  Saved       [ ⌘K Search… ]   [☀/☾]  [⬇ App]   │
├──────────────┬────────────────────────────────────────────────────────────┤
│              │  All Prompts                                                │
│  FILTERS     │  1,024 prompts            Sort: [ Newest        ▾ ]        │
│  ─────────   │  ┌ active ────────────────────────────────────────────┐    │
│  Type        │  │ Video ✕   Veo 3.1 ✕   9:16 ✕      Clear all       │    │
│  ○ All       │  └──────────────────────────────────────────────────────┘  │
│  ● Video     │                                                             │
│  ○ Image     │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│              │  │           │ │           │ │           │ │           │   │
│  Category    │  │   9:16    │ │   16:9    │ │   9:16    │ │    1:1    │   │
│  ☑ Product   │  │  preview  │ │  preview  │ │  preview  │ │  preview  │   │
│  ☐ Cinematic │  │        ▶  │ │        ▶  │ │           │ │        ▶  │   │
│  ☐ UGC       │  │           │ │  Title    │ │           │ │           │   │
│  ☐ Food      │  │  Title    │ │  Veo·16:9 │ │  Title    │ │  Title    │   │
│  ☐ Fashion   │  │  Veo·9:16 │ └───────────┘ │  Sora·9:16│ │  Kling    │   │
│    Show all ▾│  │           │ ┌───────────┐ │           │ └───────────┘   │
│              │  └───────────┘ │           │ └───────────┘ ┌───────────┐   │
│  AI Tool     │  ┌───────────┐ │  preview  │ ┌───────────┐ │  preview  │   │
│  ☑ Veo 3.1   │  │  preview  │ │           │ │  preview  │ │           │   │
│  ☐ Sora 2    │  │           │ └───────────┘ │           │ └───────────┘   │
│  ☐ Kling 2.5 │  └───────────┘               └───────────┘                 │
│              │                                                             │
│  Aspect      │                    [ Load more ]                            │
│  [9:16][16:9]│                                                             │
│  [1:1][4:5]  │                                                             │
│              │                                                             │
│  Duration    │                                                             │
│  ├──○────○──┤│                                                             │
│  0s      30s │                                                             │
│              │                                                             │
│  Options     │                                                             │
│  ☐ No ref    │                                                             │
│    image     │                                                             │
│  ☐ Templates │                                                             │
│    only      │                                                             │
└──────────────┴────────────────────────────────────────────────────────────┘
```

**Mobile:** the sidebar becomes a bottom sheet.
```
┌────────────────────────────────────────┐
│ ← All Prompts                     🔍   │
├────────────────────────────────────────┤
│ [ Filters (3) ]        [ Newest    ▾ ] │  sticky
│ [Video ✕][Veo 3.1 ✕][9:16 ✕]  Clear    │  active chips, h-scroll
├────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐      │
│ │              │ │              │      │  2-col masonry
│ │   preview    │ │   preview    │      │
│ │           ▶  │ │              │      │
│ │  Title       │ │  Title       │      │
│ │  Veo · 9:16  │ │  Sora · 1:1  │      │
│ └──────────────┘ └──────────────┘      │
└────────────────────────────────────────┘

  Filters sheet (slides up, 85vh, drag handle):
  ┌────────────────────────────────────────┐
  │              ──────                     │
  │  Filters                    Clear all   │
  │  ────────────────────────────────────   │
  │  Type      [All][Video ✓][Image]        │
  │  Category  [Product ✓][Cinematic][UGC]  │
  │  AI Tool   [Veo 3.1 ✓][Sora 2][Kling]   │
  │  Aspect    [9:16 ✓][16:9][1:1][4:5]     │
  │  Duration  ├──○──────○──┤  0–30s        │
  │  ☐ No reference image needed            │
  │  ☐ Templates only                       │
  │  ────────────────────────────────────   │
  │  [        Show 128 results         ]    │  sticky footer CTA
  └────────────────────────────────────────┘
```

**URL contract**
```
/prompts?type=video&category=product-ads&tool=veo-3-1,sora-2
        &ratio=9:16&durMin=8&durMax=15&noRef=1&sort=copies&page=2
```

**Behaviour**
- Filter counts update live; options that would return 0 results are dimmed but still selectable (never hidden — hiding options confuses users).
- Sort options: Newest · Most Copied · Most Viewed · Featured.
- Empty state: "No prompts match these filters" + a "Clear filters" button + 6 popular prompts.
- Scroll position and loaded pages are restored on back-navigation (`sessionStorage`).

---

### 10.3 Prompt Detail `/prompts/[slug]`

The most important screen. Everything above the fold answers: *what does this produce, and how do I get it?*

**Mobile wireframe**
```
┌────────────────────────────────────────┐
│ ←                          ♡    ⤴      │  back / save / share
├────────────────────────────────────────┤
│                                        │
│                                        │
│         PREVIEW MEDIA                  │  full-bleed
│      (image, or YouTube façade)        │  aspect from data:
│                                        │  9:16 → tall
│              ▶                         │  16:9 → wide
│                                        │  tap ▶ → iframe mounts
│                                        │
├────────────────────────────────────────┤
│ [🎬 Video]  [Product Ads]              │  type badge + category chip
│                                        │
│ Cinematic Desert SUV Jump              │  h1
│                                        │
│ A wide cinematic shot of a man calmly  │  description
│ seated as an SUV soars overhead.       │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ AI TOOL     Veo 3.1                │ │  meta strip
│ │ MODEL       veo-3.1-fast           │ │  2-col on ≥sm
│ │ ASPECT      9:16                   │ │
│ │ DURATION    10s                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ⚠ Needs a reference image             │  conditional callouts
│ ◆ Template — replace [Product Name]    │
│                                        │
│ ── Prompt ───────────────────  [⧉ Copy]│
│ ┌────────────────────────────────────┐ │
│ │ A cinematic wide shot of a man     │ │  monospace
│ │ wearing a stylish multi-colored    │ │  pre-wrap
│ │ shirt, sunglasses, and a cap,      │ │  --surface-2 bg
│ │ sitting calmly on a folding chair  │ │  max-h 480px
│ │ in an open desert field. Suddenly, │ │
│ │ a massive black SUV jumps high in  │ │
│ │ the air directly behind him…       │ │
│ │ ▒▒▒▒▒▒▒▒▒ fade ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │ │
│ │        ⌄ Show full prompt          │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ── Negative Prompt ─────────  [⧉ Copy] │  only if present
│ ┌────────────────────────────────────┐ │
│ │ No jitter, no anime, no            │ │
│ │ deformation, no blur, no flicker.  │ │
│ └────────────────────────────────────┘ │
│                                        │
│ How to use                             │  usageNotes, if present
│ Upload your product photo as the first │
│ reference image before running.        │
│                                        │
│ Tags                                   │
│ [slow-motion] [desert] [action] [4k]   │
│                                        │
│ ── More in Product Ads ────────────    │
│ ┌────────┐┌────────┐┌────────┐         │  related rail
│ │        ││        ││        │ ▸       │
│ └────────┘└────────┘└────────┘         │
│                                        │
├────────────────────────────────────────┤
│  [        ⧉  Copy Prompt          ]    │  sticky bottom CTA
└────────────────────────────────────────┘  above safe-area inset
```

**Desktop (≥1024px):** two columns. Left (55%) = sticky media + meta strip. Right (45%) = title, description, prompt block, tags. Related prompts run full-width below.

**Behaviour**
- **Sticky Copy CTA** on mobile, always reachable with a thumb. On desktop the copy button sits in the prompt block header.
- Copy fires: clipboard write → toast "Prompt copied" → button becomes `✓ Copied` for 2s → `POST /api/metric` (fire-and-forget, `navigator.sendBeacon`).
- Prompt block collapses past 480px height with a gradient fade and "Show full prompt". Expanded state persists per-session.
- **YouTube façade:** we render `thumbnailUrl` + a play button. The iframe (`youtube-nocookie.com`, `sandbox`, `loading="lazy"`) mounts only after a click. This saves ~700KB and several requests per page load — measurably important on the masonry grid too.
- **Shorts vs full video:** `format === 'short'` renders a `9/16` container capped at `min(80vh, 560px)` and centred; `format === 'video'` renders `16/9` full-width. The player never letterboxes a vertical video into a horizontal frame.
- Save (♡) writes to IndexedDB and animates; no account required.
- Share uses `navigator.share` when available, else copies the URL.
- Related = same `categoryId`, excluding self, ordered by `stats.copies desc`, limit 8.

**Data:** `generateStaticParams()` pre-builds every published slug. `revalidate: 3600` plus on-demand `revalidateTag('prompt:{slug}')` when the admin saves.

---

### 10.4 Categories `/categories` and `/categories/[slug]`

**`/categories`** — a grid of cards, each with cover image, icon, name, description and prompt count. 2 columns on mobile, 3–4 on desktop.

**`/categories/[slug]`** — a category hero (cover image with the category's `accentColor` gradient scrim, name, description, count), then the same filtered grid and filter set as `/prompts`, pre-scoped to the category.

```
┌────────────────────────────────────────┐
│ ←                                      │
│ ┌────────────────────────────────────┐ │
│ │  ░░░░ cover image + accent scrim ░░│ │
│ │                                    │ │
│ │  📦  Product Ads & Commercials     │ │
│ │  Hero product films, splash and    │ │
│ │  macro commercial prompts.         │ │
│ │  24 prompts                        │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ [ Filters ]              [ Newest  ▾ ] │
│ … masonry grid …                       │
└────────────────────────────────────────┘
```

---

### 10.5 Search — overlay + `/search`

Opens with ⌘K/Ctrl-K, the header search field, or the bottom-bar Search tab.

```
┌────────────────────────────────────────┐
│  🔍  cinematic product                ✕ │  autofocus
├────────────────────────────────────────┤
│  PROMPTS                               │
│  ┌──┐ Cinematic Desert SUV Jump        │  36px thumb + title
│  │▣ │ Product Ads · Veo 3.1 · Video    │
│  └──┘                                  │
│  ┌──┐ Snickers Amber Void Commercial   │
│  │▣ │ Product Ads · Sora 2 · Video     │
│  └──┘                                  │
│                                        │
│  CATEGORIES                            │
│  📦 Product Ads & Commercials     24   │
│                                        │
│  AI TOOLS                              │
│  Veo 3.1                          38   │
├────────────────────────────────────────┤
│  ↑↓ navigate   ↵ open   esc close      │
└────────────────────────────────────────┘
```

**Behaviour**
- Fully client-side over the prebuilt index (§13). Results in < 20ms; works offline.
- Debounce 120ms. Fuzzy + prefix matching, weighted: title ×4, tags ×3, aiTool ×2, description ×1.5, promptText ×1.
- Grouped results: Prompts / Categories / AI Tools.
- Empty query shows Recent searches (localStorage, max 6) and Trending (top 6 by copies).
- No results → "Nothing found for '…'" + 6 suggestions.
- `/search?q=` is a full page with the same engine, for shareable/SEO-visible search URLs.

---

### 10.6 Saved `/saved`

Local favourites, IndexedDB, no account.

```
┌────────────────────────────────────────┐
│  Saved                    [Export ⤓]   │
│  12 prompts                            │
├────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐     │
│  │   preview  ♥ │ │   preview  ♥ │     │  ♥ toggles off
│  │   Title      │ │   Title      │     │
│  └──────────────┘ └──────────────┘     │
└────────────────────────────────────────┘

Empty state:
        ┌─────────────┐
        │      ♡      │
        └─────────────┘
     Nothing saved yet
  Tap the heart on any prompt
  to keep it here.
     [ Browse prompts ]
```

Saved prompts are stored **in full** (title, promptText, preview URL, meta), so they remain readable offline. Export produces a `.json` download. A clear notice states that saves live on this device only — and that accounts are coming.

---

### 10.7 Offline `/offline`, 404, and error states

**Offline:** friendly illustration, "You're offline", plus a live list of cached prompts the user can still read. Retry button.
**404:** "This prompt doesn't exist (or was unpublished)" + search field + 6 popular prompts.
**Error boundary:** generic recovery card with a Reload action; the real error is logged server-side only, never shown to the user.

---

## 11. Screen Specifications — Admin

> **Auth decision (locked):** the admin panel uses **Firebase Authentication** — Google sign-in plus email/password. Public browsing stays completely open with no account of any kind. See [§16.2](#162-admin-access-control).

### 11.1 Admin Login `/admin/login`

```
┌────────────────────────────────────────┐
│                                        │
│              [ STS ]                   │
│                                        │
│           Admin access                 │
│      Sign in to manage the library.    │
│                                        │
│   ┌──────────────────────────────────┐ │
│   │  G   Continue with Google        │ │
│   └──────────────────────────────────┘ │
│                                        │
│   ──────────────  or  ───────────────  │
│                                        │
│   Email                                │
│   ┌──────────────────────────────────┐ │
│   │ you@example.com                  │ │
│   └──────────────────────────────────┘ │
│   Password                             │
│   ┌──────────────────────────────────┐ │
│   │ ••••••••••••                     │ │
│   └──────────────────────────────────┘ │
│                                        │
│   [           Sign in             ]    │
│                                        │
│   ⚠ That email and password don't      │
│     match an account.                  │
│                                        │
│   Only approved accounts can sign in.  │
└────────────────────────────────────────┘
```

Rate limited to 5 attempts / 15 min per IP. Firebase error codes are mapped to human sentences — a raw `auth/invalid-credential` tells the user nothing.

### 11.2 Dashboard `/admin`

```
┌──────────────┬─────────────────────────────────────────────────────────────┐
│ [LOGO]       │  Dashboard                          [+ New Prompt]  [View ↗]│
│              ├─────────────────────────────────────────────────────────────┤
│ ⊞ Dashboard  │  ┌──────────┐┌──────────┐┌──────────┐┌──────────┐          │
│ ▤ Prompts    │  │ Published││ Drafts   ││ Views 30d││ Copies   │          │
│ ⊟ Categories │  │    60    ││     4    ││  12,480  ││   3,102  │          │
│ # Tags       │  │  ▲ +6    ││          ││  ▲ 18%   ││  ▲ 24%   │          │
│ ▣ Media      │  └──────────┘└──────────┘└──────────┘└──────────┘          │
│ ⚙ Settings   │                                                             │
│ ⤒ Import     │  Recent activity              Top prompts (30d)             │
│ ◔ Analytics  │  ┌─────────────────────────┐  ┌───────────────────────────┐│
│              │  │ ✎ Edited "Snickers…"    │  │ 1. Desert SUV Jump   842 ⧉││
│ ──────────   │  │   2 hours ago           │  │ 2. Hot Dog Commercial 611 ⧉││
│ ☾ Theme      │  │ + Published "Hot Dog…"  │  │ 3. Barbie Giant Hands 508 ⧉││
│ ⏻ Sign out   │  │   yesterday             │  │ 4. 1950s Diner Freeze 477 ⧉││
│              │  └─────────────────────────┘  └───────────────────────────┘│
│              │                                                             │
│              │  Needs attention                                            │
│              │  ⚠ 3 prompts have no preview media          [Review →]      │
│              │  ⚠ 2 prompts are uncategorised              [Review →]      │
│              │  ⚠ 5 media files are unused (1.2 MB)        [Clean up →]    │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

The "Needs attention" panel is the quality guard-rail — it surfaces exactly the problems the source document has (missing categories, missing previews).

---

### 11.3 Prompts List `/admin/prompts`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Prompts (64)                                            [+ New Prompt]     │
│  ┌──────────────────────┐ [Status ▾][Type ▾][Category ▾][Tool ▾]  Clear     │
│  │ 🔍 Search…           │                                                    │
│  └──────────────────────┘                                                    │
│  ☑ 3 selected   [Publish] [Unpublish] [Set category ▾] [Delete]             │
├───┬──────┬────────────────────────┬─────────┬──────────┬────────┬───────────┤
│ ☑ │ ▣    │ Title                  │ Type    │ Category │ Status │ Updated   │
├───┼──────┼────────────────────────┼─────────┼──────────┼────────┼───────────┤
│ ☑ │ [img]│ Cinematic Desert SUV…  │ 🎬 Video│ Product  │ ● Pub  │ 2h ago  ⋮ │
│ ☑ │ [img]│ Snickers Amber Void    │ 🎬 Video│ Product  │ ● Pub  │ 1d ago  ⋮ │
│ ☑ │ [ ▶ ]│ Perfect Hot Dog        │ 🎬 Video│ Food     │ ● Pub  │ 2d ago  ⋮ │
│ ☐ │ [img]│ Luxury Ad Set (6 imgs) │ 🖼 Image│ Story…   │ ○ Draft│ 3d ago  ⋮ │
│ ☐ │  ⚠   │ Untitled prompt        │ 🎬 Video│ —        │ ○ Draft│ 5d ago  ⋮ │
├───┴──────┴────────────────────────┴─────────┴──────────┴────────┴───────────┤
│                        ‹ 1 2 3 ›            25 per page ▾                    │
└─────────────────────────────────────────────────────────────────────────────┘
```
Row menu (⋮): Edit · Preview · Duplicate · Toggle featured · Copy public URL · Delete.
Mobile: the table degrades to stacked cards with a swipe-to-reveal action drawer.

---

### 11.4 Prompt Editor `/admin/prompts/new` · `/admin/prompts/[id]`

The most important admin screen. Two columns on desktop: form left, **live preview right**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Prompts    New Prompt              [Draft ●] [Preview ↗] [Save] [Publish] │
├──────────────────────────────────────────┬──────────────────────────────────┤
│                                          │  LIVE PREVIEW                    │
│  ── Basics ────────────────────────────  │  ┌────────────────────────────┐  │
│  Title *                                 │  │                            │  │
│  ┌────────────────────────────────────┐  │  │                            │  │
│  │ Cinematic Desert SUV Jump          │  │  │       preview media        │  │
│  └────────────────────────────────────┘  │  │             ▶              │  │
│  Slug   cinematic-desert-suv-jump  [✎]   │  │                            │  │
│                                          │  │                            │  │
│  Description                             │  ├────────────────────────────┤  │
│  ┌────────────────────────────────────┐  │  │ [🎬 Video] [Product Ads]   │  │
│  │ A wide cinematic shot of a man…    │  │  │                            │  │
│  └────────────────────────────────────┘  │  │ Cinematic Desert SUV Jump  │  │
│                              62/280      │  │                            │  │
│                                          │  │ A wide cinematic shot of…  │  │
│  Type *      [ 🖼 Image ] [ 🎬 Video ✓ ]  │  │                            │  │
│  Category *  [ Product Ads          ▾ ]  │  │ AI TOOL   Veo 3.1          │  │
│  Tags        [slow-motion ✕][desert ✕]   │  │ ASPECT    9:16             │  │
│              [+ Add tag]                 │  │ DURATION  10s              │  │
│                                          │  │                            │  │
│  ── Prompt ────────────────────────────  │  │ ── Prompt ──────── [⧉]     │  │
│  Prompt text *              [Aa] [⛶]     │  │ ┌────────────────────────┐ │  │
│  ┌────────────────────────────────────┐  │  │ │ A cinematic wide shot  │ │  │
│  │ A cinematic wide shot of a man     │  │  │ │ of a man wearing a…    │ │  │
│  │ wearing a stylish multi-colored    │  │  │ └────────────────────────┘ │  │
│  │ shirt, sunglasses, and a cap,      │  │  └────────────────────────────┘  │
│  │ sitting calmly on a folding chair  │  │                                  │
│  │ in an open desert field…           │  │  [ Mobile ] [ Desktop ]          │
│  │                                    │  │  [ Light ]  [ Dark ]             │
│  └────────────────────────────────────┘  │                                  │
│  1,240 chars · 198 words                 │                                  │
│  ⚠ Placeholders found: [Product Name]    │                                  │
│                                          │                                  │
│  Negative prompt                         │                                  │
│  ┌────────────────────────────────────┐  │                                  │
│  │ No jitter, no anime, no blur…      │  │                                  │
│  └────────────────────────────────────┘  │                                  │
│                                          │                                  │
│  Usage notes                             │                                  │
│  ┌────────────────────────────────────┐  │                                  │
│  │ Upload a product photo first.      │  │                                  │
│  └────────────────────────────────────┘  │                                  │
│                                          │                                  │
│  ── Preview media ─────────────────────  │                                  │
│  Source  [ Upload ✓ ] [ Image URL ] [ YouTube ]                             │
│                                          │                                  │
│  ┌────────────────────────────────────┐  │                                  │
│  │        ⬆                           │  │                                  │
│  │   Drag & drop, click, or paste     │  │                                  │
│  │   JPG · PNG · WEBP · AVIF          │  │                                  │
│  │   max 10 MB                        │  │                                  │
│  └────────────────────────────────────┘  │                                  │
│  Alt text * ┌──────────────────────────┐ │                                  │
│             │ SUV jumping over a man…  │ │                                  │
│             └──────────────────────────┘ │                                  │
│                                          │                                  │
│  Extra stills (gallery)   [+ Add] 0/6    │                                  │
│                                          │                                  │
│  ── Generation metadata ───────────────  │                                  │
│  AI tool *   [ Veo 3.1              ▾ ]  │                                  │
│  Model       [ veo-3.1-fast           ]  │                                  │
│  Aspect      [9:16 ✓][16:9][1:1][4:5]    │                                  │
│  Duration    [ 10 ] seconds              │                                  │
│  ☑ Requires a reference image            │                                  │
│                                          │                                  │
│  ── Publishing ────────────────────────  │                                  │
│  ☐ Feature on home page                  │                                  │
│  SEO title / description  (optional) ▾   │                                  │
│                                          │                                  │
│  Autosaved 12 seconds ago                │                                  │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

**Preview media — three sources**

**A. Upload (default)**
```
┌────────────────────────────────────────┐
│   ┌──────────┐                         │
│   │  ▣ img   │  desert-suv.webp        │
│   │  thumb   │  1080×1920 · 842 KB     │
│   └──────────┘  ✓ Uploaded             │
│                 [Replace] [Remove]     │
│   ████████████████████████░░░░  86%    │  during upload
└────────────────────────────────────────┘
```
Drag-drop, click-to-browse, and **paste from clipboard** (⌘V an image straight in — this alone saves the admin a lot of time). Client-side: validate type + size, downscale anything over 2400px, convert to WebP, generate the blur placeholder, then `PUT` straight to R2 via a presigned URL with a progress ring.

**B. Image URL**
```
┌────────────────────────────────────────┐
│ https://example.com/preview.jpg   [↻]  │
│ ✓ Valid image · 1200×675 · JPEG        │
│ ┌──────────────┐                       │
│ │  live thumb  │  ☐ Copy to R2 storage │
│ └──────────────┘    (recommended)      │
└────────────────────────────────────────┘
```
The URL is validated server-side (HTTPS only, HEAD request, content-type check, SSRF guards). "Copy to R2" is checked by default because external URLs rot — but it can be unchecked.

**C. YouTube**
```
┌────────────────────────────────────────┐
│ Paste any YouTube URL                  │
│ ┌────────────────────────────────────┐ │
│ │ https://youtube.com/shorts/dQw4w9… │ │
│ └────────────────────────────────────┘ │
│ ✓ Detected: SHORT (9:16 vertical)      │
│   ID dQw4w9WgXcQ                       │
│                                        │
│      ┌──────────────┐                  │
│      │              │                  │
│      │   9:16       │  Auto-fetched:   │
│      │   preview    │  "Desert SUV     │
│      │       ▶      │   Jump — Veo 3"  │
│      │              │                  │
│      └──────────────┘                  │
│                                        │
│ Format  [ Auto ✓ ] [ Short ] [ Video ] │  manual override
│ Start at [ 0 ] seconds                 │
└────────────────────────────────────────┘
```
Accepts **every** YouTube URL form (see §12.3), auto-detects Short vs full video, fetches the title via oEmbed, and picks the best available thumbnail. The Format control lets the admin override detection if YouTube's URL is misleading.

**Editor behaviour**
- Autosave as draft every 20s and on blur; a visible "Autosaved Xs ago" timestamp.
- `beforeunload` guard on unsaved changes.
- Live preview panel toggles Mobile/Desktop × Light/Dark — so the admin verifies both themes before publishing.
- Publish is blocked with inline errors until: title, prompt text, type, category, AI tool, preview media and alt text are all present.
- **Placeholder detection:** regex scans for `[…]`, `{…}`, `@Image\d`, `@\d`; sets `hasPlaceholders` and shows a warning chip.
- **Text cleanup tool** (`[Aa]` button): one click removes OCR artefacts found in the source doc — de-hyphenates `com- mercial` → `commercial`, collapses doubled words (`rendering, rendering,`), normalises whitespace, trims. Shows a diff before applying.
- Fullscreen editor (`⛶`) for very long prompts.
- Publishing triggers `revalidateTag` for the prompt, its category, and the home page.

---

### 11.5 Categories `/admin/categories`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Categories (11)                                    [+ New Category]│
├──────┬──────┬──────────────────────┬────────┬─────────┬─────────────┤
│  ⣿   │ ▣    │ Name                 │ Slug   │ Prompts │ Visible     │
├──────┼──────┼──────────────────────┼────────┼─────────┼─────────────┤
│  ⣿   │ 📦●  │ Product Ads & Comm…  │ product│   24    │  ●━━  ⋮     │
│  ⣿   │ 🎬●  │ Cinematic Film       │ cinema…│    9    │  ●━━  ⋮     │
│  ⣿   │ 📱●  │ UGC & Vlog Style     │ ugc-vl…│    6    │  ●━━  ⋮     │
│  ⣿   │ 🍔●  │ Food & Beverage      │ food-b…│    7    │  ●━━  ⋮     │
└──────┴──────┴──────────────────────┴────────┴─────────┴─────────────┘
   ⣿ = drag handle (reorders `order`)      ● = accentColor swatch
```

Editor sheet: name, slug (auto, editable pre-publish), description, icon picker (Lucide search), accent colour picker (OKLCH with a live contrast check), cover image, visibility toggle. Deleting a category with prompts is blocked — the admin must reassign first, and a "Move all N prompts to…" shortcut is offered.

---

### 11.6 Media Library `/admin/media`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Media                        Used 248 MB          [⬆ Upload]       │
│  [🔍 Search] [All ▾] [Unused ▾]        [▦ Grid] [☰ List]            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐       │
│  │  ☑     ││        ││   ⚠    ││        ││        ││        │       │
│  │  img   ││  img   ││  img   ││  img   ││  img   ││  img   │       │
│  │        ││        ││ unused ││        ││        ││        │       │
│  └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘       │
│   842 KB   1.2 MB    340 KB    980 KB    1.1 MB    620 KB           │
├─────────────────────────────────────────────────────────────────────┤
│  1 selected   [Copy URL] [Download] [Delete]                        │
└─────────────────────────────────────────────────────────────────────┘
```
Detail drawer shows the R2 key, public URL, dimensions, size, MIME, upload date, and **which prompts use it**. Deleting an in-use asset is blocked with a list of blockers. The "Unused" filter plus bulk delete keeps storage clean.

---

### 11.7 Site Settings `/admin/settings`

Tabbed: **Branding · SEO · Appearance · Social**.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Settings                                          [Save changes]   │
│  [ Branding ✓ ] [ SEO ] [ Appearance ] [ Social ]                   │
├─────────────────────────────────────────────────────────────────────┤
│  Site name     [ STS Prompt Library                                    ]   │
│  Tagline       [ AI prompts that actually work                  ]   │
│                                                                     │
│  ── Logos ────────────────────────────────────────────────────────  │
│  Light-mode logo              Dark-mode logo                        │
│  (shown on light backgrounds) (shown on dark backgrounds)           │
│  ┌───────────────────────┐    ┌───────────────────────┐             │
│  │ ░░░░░░░░░░░░░░░░░░░░ │    │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │             │
│  │ ░░  [ LOGO ]     ░░ │    │ ▓▓  [ LOGO ]     ▓▓ │             │
│  │ ░░░░░░░░░░░░░░░░░░░░ │    │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │             │
│  └───────────────────────┘    └───────────────────────┘             │
│   [Replace] [Remove]           [Replace] [Remove]                   │
│   SVG/PNG · max 1 MB · h 40px  SVG/PNG · max 1 MB · h 40px          │
│                                                                     │
│  App icon / mark (square)      Favicon                              │
│  ┌──────┐                      ┌────┐                               │
│  │ 512² │  Used for the PWA    │ ▣  │  32×32 or SVG                 │
│  └──────┘  home-screen icon    └────┘                               │
│                                                                     │
│  ── Accent colour ────────────────────────────────────────────────  │
│  [ ● ] oklch(0.548 0.216 286)   [🎨 Pick]                           │
│  ● ● ● ● ● ●  presets                                               │
│  ✓ Contrast passes AA in both light and dark                        │
│                                                                     │
│  ── Live preview ─────────────────────────────────────────────────  │
│  ┌───────────────────────┐  ┌───────────────────────┐               │
│  │ ░ LIGHT               │  │ ▓ DARK                │               │
│  │ [LOGO]   [Button]     │  │ [LOGO]   [Button]     │               │
│  └───────────────────────┘  └───────────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

**Why two logos, not one:** a single logo file cannot read correctly on both a near-white and a near-black background. Uploading both is the only correct answer, and the side-by-side preview makes the requirement obvious. If only one is uploaded, it is used for both with a warning.

Appearance tab: default theme (System/Light/Dark), announcement bar, home hero headline/subline.
SEO tab: title template, default OG image, canonical host, Twitter handle, robots preview.

---

### 11.8 Import `/admin/import`

Directly addresses the 60 prompts sitting in the source `.docx`.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Import prompts                                                     │
│  Step ①  Upload   →   ② Map fields   →   ③ Review   →   ④ Import    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                          ⬆                                    │  │
│  │        Drop a .json or .csv file, or click to browse           │  │
│  │        [Download template ⤓]                                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ③ Review — 60 rows                                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ✓ 54 ready    ⚠ 6 warnings    ✕ 0 errors                      │  │
│  ├───┬────────────────────────┬─────────┬──────────┬─────────────┤  │
│  │ ✓ │ Cinematic Desert SUV…  │ Video   │ Product  │ ready       │  │
│  │ ⚠ │ Fanta Can Splash       │ Video   │ —        │ no category │  │
│  │ ⚠ │ Prompt 45              │ Video   │ Cinematic│ empty text  │  │
│  └───┴────────────────────────┴─────────┴──────────┴─────────────┘  │
│                                                                     │
│  Import as  ( ● Drafts   ○ Published )                              │
│  ☑ Run text cleanup (de-hyphenate, fix doubled words)               │
│  ☑ Skip rows whose slug already exists                              │
│                                                                     │
│              [ Cancel ]        [ Import 54 prompts ]                │
└─────────────────────────────────────────────────────────────────────┘
```
Always a **dry-run first**. Imports default to **Drafts** so nothing half-finished reaches the public site. Rows are validated with the same Zod schema as the editor. A downloadable template documents every field.

---

### 11.9 Analytics `/admin/analytics`

Range selector (7d / 30d / 90d / all). Line chart of views and copies. Top 20 prompts by copies with copy-rate. Breakdown by category, AI tool and type. Top search queries that returned zero results — the single most useful signal for deciding what to add next.

---

## 12. Media Pipeline (Cloudflare R2 + YouTube)

### 12.1 R2 setup

| Item | Value |
|---|---|
| Bucket | `sts-prompt-library-media` |
| Public access | **Disabled** on the `r2.dev` URL |
| Delivery | Custom domain `cdn.stsprompts.com` bound to the bucket, fronted by Cloudflare CDN |
| Egress | Zero (R2's core advantage over S3) |
| Key format | `{scope}/{yyyy}/{MM}/{nanoid(12)}.{ext}` — e.g. `prompts/2026/08/a7Kd93nQx2Lp.webp` |
| Cache-Control | `public, max-age=31536000, immutable` (keys are content-unique, so never stale) |
| CORS | `PUT` allowed only from the production origin + `http://localhost:3000` |
| Lifecycle | Abort incomplete multipart uploads after 1 day |

**Filenames are never derived from user input.** A random nanoid key eliminates path traversal, collisions and content-sniffing tricks in one stroke.

### 12.2 Upload flow

```
 Browser                     Next.js server                  R2
    │                              │                          │
    │ 1. select/paste/drop file    │                          │
    │─ validate type + size        │                          │
    │─ downscale >2400px           │                          │
    │─ encode WebP q=82            │                          │
    │─ make blurDataURL            │                          │
    │                              │                          │
    │ 2. POST /api/admin/upload-url│                          │
    │   {mime, bytes, w, h}        │                          │
    │─────────────────────────────>│                          │
    │                              │ verify admin session     │
    │                              │ check rate limit         │
    │                              │ allowlist mime           │
    │                              │ enforce max bytes        │
    │                              │ build random key         │
    │                              │ sign PUT (5 min TTL,     │
    │                              │  content-type +          │
    │                              │  content-length locked)  │
    │ 3. {uploadUrl, key, cdnUrl}  │                          │
    │<─────────────────────────────│                          │
    │                              │                          │
    │ 4. PUT file (progress)       │                          │
    │────────────────────────────────────────────────────────>│
    │ 5. 200 OK                    │                          │
    │<────────────────────────────────────────────────────────│
    │                              │                          │
    │ 6. POST /api/admin/upload-complete                      │
    │   {key, w, h, blurDataURL}   │                          │
    │─────────────────────────────>│                          │
    │                              │ HEAD object → verify it  │
    │                              │ exists, size + mime match│
    │                              │─────────────────────────>│
    │                              │ write media/{id} doc     │
    │ 7. {mediaAsset}              │                          │
    │<─────────────────────────────│                          │
```

**Why presigned PUT rather than routing bytes through the server:** the file never touches the Next.js runtime, so there is no serverless body-size limit, no function-duration cost, and no memory pressure. The server only ever signs and verifies.

**Constraints**

| Rule | Value |
|---|---|
| Allowed preview MIME | `image/jpeg`, `image/png`, `image/webp`, `image/avif` |
| Allowed logo MIME | above + `image/svg+xml` (sanitised server-side before storing) |
| Max preview size | 10 MB pre-compression |
| Max logo size | 1 MB |
| Max dimension | 2400px on the long edge (auto-downscaled client-side) |
| Presign TTL | 5 minutes |
| Upload rate limit | 30 presign requests / 10 min per session |

**SVG handling:** SVG is an executable document format and a well-known XSS vector. Uploaded SVGs are parsed server-side and stripped of `<script>`, `<foreignObject>`, event handlers and external references before being written to R2. They are also served with `Content-Disposition: inline` and a restrictive CSP. If that is ever in doubt, PNG-only for logos is the safe fallback.

**Orphan cleanup:** a weekly job lists `media` docs with an empty `usedBy` and an `uploadedAt` older than 7 days, and reports them to the dashboard for one-click deletion. Never auto-delete — a wrongly-deleted asset breaks a live page.

### 12.3 YouTube handling

Accepted URL forms, all normalised to an 11-character ID:

| Form | Example | Detected format |
|---|---|---|
| Shorts | `youtube.com/shorts/{id}` | **short** |
| Watch | `youtube.com/watch?v={id}` | video |
| Short link | `youtu.be/{id}` | video |
| Embed | `youtube.com/embed/{id}` | video |
| No-cookie | `youtube-nocookie.com/embed/{id}` | video |
| Live | `youtube.com/live/{id}` | video |
| Mobile | `m.youtube.com/watch?v={id}` | video |
| With extras | `…?v={id}&t=42s&list=PL…` | video, `startSeconds=42` |
| Bare ID | `dQw4w9WgXcQ` | video |

```ts
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTube(input: string):
  | { ok: true; id: string; format: 'short' | 'video'; startSeconds?: number }
  | { ok: false; reason: string } {
  const raw = input.trim();
  if (YT_ID.test(raw)) return { ok: true, id: raw, format: 'video' };

  let u: URL;
  try { u = new URL(raw.startsWith('http') ? raw : `https://${raw}`); }
  catch { return { ok: false, reason: 'Not a valid URL' }; }

  const host = u.hostname.replace(/^www\.|^m\./, '');
  const allowed = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];
  if (!allowed.includes(host)) return { ok: false, reason: 'Not a YouTube URL' };

  const seg = u.pathname.split('/').filter(Boolean);
  let id: string | undefined;
  let format: 'short' | 'video' = 'video';

  if (host === 'youtu.be')                 id = seg[0];
  else if (seg[0] === 'shorts')          { id = seg[1]; format = 'short'; }
  else if (seg[0] === 'embed' || seg[0] === 'live' || seg[0] === 'v') id = seg[1];
  else if (u.pathname === '/watch')        id = u.searchParams.get('v') ?? undefined;

  if (!id || !YT_ID.test(id)) return { ok: false, reason: 'Could not find a video ID' };

  const t = u.searchParams.get('t') ?? u.searchParams.get('start');
  const startSeconds = t ? parseInt(t.replace(/\D/g, ''), 10) || undefined : undefined;

  return { ok: true, id, format, startSeconds };
}
```

**Aspect-ratio detection is stored, not guessed.** Because a Short can also be reached via a `watch?v=` URL, the admin gets an explicit **Auto / Short / Video** override in the editor, and the chosen value is persisted on the document.

**Thumbnails:** try `maxresdefault.jpg` → fall back to `hqdefault.jpg` (verified with a HEAD request at save time, since not every video has a maxres). Fetch the human title via the public oEmbed endpoint. Thumbnails are optionally mirrored to R2 so the grid does not depend on `i.ytimg.com` availability.

**Embed rendering**
```tsx
<iframe
  src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${start ? `&start=${start}` : ''}`}
  title={title}
  loading="lazy"
  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerPolicy="strict-origin-when-cross-origin"
  allowFullScreen
/>
```
Wrapped in a container with `aspect-ratio: 9/16` (max-height `min(80vh, 560px)`, centred) or `16/9`. Mounted only after the user activates the façade.

### 12.4 External image URLs

When the admin chooses "Image URL" and declines the R2 copy, the URL is:
1. Required to be `https:`.
2. Resolved and checked against a blocklist of private/link-local ranges (`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`) to prevent SSRF.
3. HEAD-requested to confirm an `image/*` content type and a sane content length.
4. Rendered through `next/image` with the host added to `images.remotePatterns`, or through `/api/image-proxy` (which re-applies the same guards, disallows redirects to private ranges, caps response size, and sets a 10s timeout).

**The default remains "copy to R2"** — external hosts disappear, hotlink-block, or serve different content later.

---

## 13. Search Architecture

**Decision: a prebuilt static index + client-side MiniSearch.** Firestore has no full-text search; Algolia/Typesense adds cost and an operational surface we do not need at this scale.

**How it works**

1. On publish/unpublish/edit, the server regenerates `search-index.json`:
```json
[{ "i":"a7Kd93nQ", "s":"cinematic-desert-suv-jump", "t":"Cinematic Desert SUV Jump",
   "d":"A wide cinematic shot…", "c":"product-ads", "y":"video",
   "l":"Veo 3.1", "g":["slow-motion","desert"], "r":"9:16",
   "th":"https://cdn…/a7Kd.webp", "b":"data:image/…" }]
```
2. Served from `/api/search-index` with `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` and an ETag.
3. The client fetches it once (on first search intent, not on page load), stores it in IndexedDB, and revalidates in the background.
4. MiniSearch indexes it in the browser with field weights: `title ×4`, `tags ×3`, `aiTool ×2`, `description ×1.5`, `promptText ×1`. Fuzzy `0.2`, prefix matching on.

**Size:** ~700 bytes per prompt including a blur thumb → **~70 KB for 100 prompts, ~700 KB for 1,000** (well under 200 KB gzipped for 1,000 without blur data). At 5,000+ prompts, switch the payload to title/tags only and defer to a server route — or adopt Typesense.

**Consequences:** search is instant, free, and works fully offline. Zero Firestore reads per search, no matter the traffic. A server-side `/search?q=` fallback exists purely so search pages are crawlable and work without JS.

---

## 14. PWA Specification

### 14.1 Manifest (`app/manifest.ts`)

```ts
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'STS Prompt Library — AI Image & Video Prompts',
    short_name: 'STS Prompts',
    description: 'Copy-ready AI image and video prompts, each shown with its real output.',
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'browser'],
    orientation: 'portrait-primary',
    background_color: '#282833',   // matches --bg dark; prevents a white flash on splash
    theme_color: '#282833',
    categories: ['productivity', 'graphics', 'utilities'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      { src: '/icons/icon-192.png',  sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png',  sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Search prompts', url: '/search', icons: [{ src: '/icons/sc-search.png', sizes: '96x96' }] },
      { name: 'Video prompts',  url: '/prompts?type=video', icons: [{ src: '/icons/sc-video.png', sizes: '96x96' }] },
      { name: 'Image prompts',  url: '/prompts?type=image', icons: [{ src: '/icons/sc-image.png', sizes: '96x96' }] },
      { name: 'Saved',          url: '/saved', icons: [{ src: '/icons/sc-saved.png', sizes: '96x96' }] },
    ],
    screenshots: [
      { src: '/screenshots/mobile-home.png',  sizes: '390x844',   type: 'image/png', form_factor: 'narrow' },
      { src: '/screenshots/mobile-detail.png',sizes: '390x844',   type: 'image/png', form_factor: 'narrow' },
      { src: '/screenshots/desktop-browse.png',sizes: '1440x900', type: 'image/png', form_factor: 'wide' },
    ],
  };
}
```
`screenshots` matter — they turn the Chrome install prompt into a rich, app-store-style dialog rather than a bare banner. `theme_color` is also updated at runtime by a `<meta name="theme-color">` that follows the active theme.

**Icons must be generated from the admin-uploaded `logoMark`.** A build/admin action renders the 192/512 `any` and `maskable` variants (maskable needs ~20% safe-area padding, or Android will crop the logo).

### 14.2 Service worker (Serwist)

| Route pattern | Strategy | Cache | Expiry |
|---|---|---|---|
| App shell / precache | Precache | `serwist-precache` | on SW update |
| Navigations (HTML) | `NetworkFirst` (3s timeout) → `/offline` | `pages` | 32 entries / 1 day |
| `cdn.stsprompts.com/*` (R2 media) | `CacheFirst` | `media` | 120 entries / 30 days |
| `i.ytimg.com/*` (YT thumbs) | `StaleWhileRevalidate` | `yt-thumbs` | 80 entries / 7 days |
| `/api/search-index` | `StaleWhileRevalidate` | `search` | 1 entry / 1 day |
| `/_next/static/*` | `CacheFirst` | `static` | 1 year |
| Fonts | `CacheFirst` | `fonts` | 1 year |
| `/api/admin/*`, `/admin/*` | **NetworkOnly, never cached** | — | — |

Admin routes are explicitly excluded from every cache — caching an authenticated response is a classic and serious leak.

**Update flow:** a new SW installs in the background and posts a message; the app shows a "New version available — Refresh" toast rather than reloading under the user.

### 14.3 Install experience

```
Android / Desktop Chrome                iOS Safari
┌────────────────────────────┐          ┌────────────────────────────┐
│  ┌────┐                    │          │  ┌────┐                    │
│  │icon│  Install STS Prompt Library│         │  │icon│  Add to Home Screen │
│  └────┘  Fast, offline-     │         │  └────┘                    │
│          ready, home screen │          │                            │
│                             │          │  1. Tap  ⤴  Share          │
│  [ Not now ]  [ Install ]   │          │  2. Scroll to              │
└────────────────────────────┘          │     "Add to Home Screen" ⊞ │
                                        │  3. Tap Add                │
  captures beforeinstallprompt          │        [ Got it ]          │
  and calls prompt() on click           └────────────────────────────┘
```

**Rules:** never shown on the first visit. Trigger on the 2nd session **or** after 3 prompt views, whichever comes first. Dismissal is remembered for 30 days. Never shown when already running in standalone mode (`display-mode: standalone`). An "Install app" item also lives permanently in the header/menu so a user who dismissed it can still find it.

### 14.4 Offline capability

| Works offline | Does not work offline |
|---|---|
| App shell and navigation | New prompts not yet visited |
| Every prompt visited in the last 30 days (text + media) | YouTube video playback |
| All saved/favourited prompts, stored in full | Admin panel (by design) |
| Full search over the cached index | Live view/copy counters (queued via Background Sync) |
| Theme switching | |

---

## 15. Theming — Dark & Light

### 15.1 Behaviour

- Three states: **System** (default) · **Light** · **Dark**.
- Choice persists in `localStorage` under `pv-theme`.
- **No flash of wrong theme.** A tiny blocking inline script in `<head>` reads the stored value (or `prefers-color-scheme`) and sets `class="dark"` on `<html>` before first paint.

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem('pv-theme') || 'system';
      var d = t === 'dark' || (t === 'system' &&
              matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', d);
      document.documentElement.style.colorScheme = d ? 'dark' : 'light';
    } catch (e) {}
  })();
</script>
```

- `<meta name="theme-color">` is updated on change so the mobile browser chrome and the PWA status bar match.
- `color-scheme` is set so native form controls, scrollbars and the overscroll area render correctly.
- In System mode, the app follows live OS changes via `matchMedia` without a reload.

### 15.2 Dark-mode specifics

Dark themes fail in predictable ways. Explicit rules:

1. **Never pure black** — `oklch(0.158 …)`, not `#000`. Pure black causes smearing on OLED and makes shadows impossible.
2. **Never pure white text** — `oklch(0.962 …)`. Full-white on near-black causes halation.
3. **Elevation is signalled by lighter surfaces plus borders, not by shadows.** Shadows are nearly invisible on dark backgrounds; `--border` does the work.
4. **Accent lightness is raised in dark mode** (`0.548` → `0.712`) so it keeps AA contrast against a dark surface.
5. **Media gets a 1px inset border** in dark mode (`inset 0 0 0 1px oklch(1 0 0 / 0.06)`) so light-edged images do not bleed into the page.
6. **Images are never dimmed.** Some dark themes apply a brightness filter; here the media *is* the product, and it must render true.
7. **The logo swaps** to `logoDark` — this is why two uploads exist.

### 15.3 Admin theme

The admin panel inherits the same tokens and toggle. The editor's live preview panel has its *own independent* Light/Dark switch, so the admin can check public appearance in both themes without changing their own working theme.

---

## 16. Security Specification

Requirement: *"do the security things as well so no one can hack this site."* This section is the contract.

### 16.1 Threat model

| Threat | Impact | Mitigation |
|---|---|---|
| Unauthorised admin write / defacement | **Critical** | §16.2 admin gate + §16.3 Firestore rules |
| Direct Firestore client writes bypassing the app | **Critical** | Client writes denied outright; all writes via Admin SDK |
| Draft/unpublished content leaking | High | Rules restrict reads to `status == 'published'` |
| XSS via prompt text or SVG logo | High | §16.5 |
| SSRF via external image URL | High | §16.6 |
| Storage abuse / unbounded uploads | Medium | Presign auth + MIME/size limits + rate limits |
| Credential exposure in the client bundle | **Critical** | §16.7 secret hygiene |
| Brute-force on the admin passcode | High | Rate limit + constant-time compare + lockout |
| Clickjacking of the admin panel | Medium | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| CSRF on admin mutations | Medium | `SameSite=Strict` cookie + Origin check |
| Denial of wallet (Firestore read costs) | Medium | Static/ISR serving + no per-request reads |
| Dependency supply chain | Medium | pnpm lockfile, `pnpm audit` in CI, Dependabot |

### 16.2 Admin access control

**Firebase Authentication with server-verified session cookies.**

```
1. Browser signs in via Firebase Auth (Google popup or email/password)
       │
       ▼  ID token (short-lived, held only in memory)
2. POST /api/admin/session
       ├─ rate limit: 5 / 15 min / IP
       ├─ verifyIdToken(token, checkRevoked)
       ├─ require auth_time within the last 5 minutes
       │    (so a stolen long-lived token can't mint a session)
       ├─ authorise: custom claim `admin: true` OR ADMIN_EMAILS allowlist
       └─ createSessionCookie(...)  →  Set-Cookie
            sts_session=<cookie>; HttpOnly; Secure; SameSite=Strict; Max-Age=5d
       │
       ▼
3. Client signs out of the Firebase SDK immediately.
   The HttpOnly cookie is now the only credential — and it is
   unreadable from JavaScript, which an ID token in storage is not.
```

**Verification.** `requireAdmin()` calls `verifySessionCookie(value, true)` on every request. `checkRevoked: true` means disabling the account in the Firebase console kills live sessions immediately. Signing out calls `revokeRefreshTokens`, so the session dies on every device, not just the current browser.

**Authorisation.** An account is an admin if it holds the `admin: true` custom claim, **or** its email is in `ADMIN_EMAILS`. The allowlist exists so the very first sign-in can succeed before any claim has been set; `pnpm set:admin <email>` then grants the durable claim.

**Enforcement points — all three, independently:**

| Layer | Check | Purpose |
|---|---|---|
| `proxy.ts` | cookie present? | Redirect convenience only. **Not** a security boundary. |
| `app/admin/(panel)/layout.tsx` | `requireAdmin()` | Guards every admin page. `/admin/login` sits outside this group. |
| every `/api/admin/*` route | `guardAdmin()` | Origin + session + rate limit. Never trusts the proxy. |

### 16.3 Firestore security rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Public may read ONLY published prompts. No client writes, ever.
    match /prompts/{promptId} {
      allow read: if resource.data.status == 'published';
      allow write: if false;
    }

    match /categories/{categoryId} {
      allow read: if resource.data.isVisible == true;
      allow write: if false;
    }

    match /tags/{tagId} {
      allow read: if true;
      allow write: if false;
    }

    // Site settings are public (logo, name) but never client-writable.
    match /settings/{docId} {
      allow read: if true;
      allow write: if false;
    }

    // Media registry is internal only.
    match /media/{mediaId} {
      allow read, write: if false;
    }

    // Deny everything else by default.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**`allow write: if false` on every collection is deliberate.** The Firebase Admin SDK bypasses rules entirely, so all legitimate writes still work through server routes. This means there is *no possible path* for a browser to write to the database — the strongest posture available while there is no user auth.

Rules are covered by unit tests with `@firebase/rules-unit-testing` in CI: a client read of a draft must fail, a client write must fail, and a published read must succeed.

### 16.4 HTTP security headers

**A nonce-based CSP would disable static rendering, ISR and CDN caching for the whole site** — Next.js can only apply a per-request nonce while rendering dynamically. That would undo the scaling strategy in §17. So the policy is split by surface:

| Surface | `script-src` | Rendering |
|---|---|---|
| `/admin/*`, `/api/admin/*` | `'self' 'nonce-{N}' 'strict-dynamic'` | Dynamic + `no-store` anyway |
| Everything public | `'self' 'unsafe-inline'` | **Static / SSG preserved** |

`'unsafe-inline'` is required on public routes because React's streaming payload is injected inline. It is an accepted trade-off there: those pages carry no session to steal, all content renders as text nodes (`dangerouslySetInnerHTML` is banned repo-wide), and there is no user-generated content. The strict directives below still apply to both.

Setting a header from `proxy.ts` does **not** force dynamic rendering — only *reading* `headers()` inside a page does, which public pages never do.

```
default-src 'self';
script-src   <per §16.4 table>;
style-src    'self' 'unsafe-inline';        /* Tailwind injects at runtime */
img-src      'self' data: blob: <cdn> https://i.ytimg.com https://img.youtube.com;
media-src    'self' <cdn>;
font-src     'self' data:;
frame-src    https://www.youtube-nocookie.com https://www.youtube.com;
connect-src  'self' <cdn> https://*.googleapis.com https://*.firebaseio.com
             https://identitytoolkit.googleapis.com https://securetoken.googleapis.com;
worker-src   'self' blob:;
manifest-src 'self';
form-action  'self';
frame-ancestors 'none';
base-uri     'self';
object-src   'none';
upgrade-insecure-requests
```

Plus, from `next.config.ts`:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
Cross-Origin-Opener-Policy: same-origin
```

`/admin/*` additionally sends `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: no-store, must-revalidate`.

> **Future option:** Next 16 ships experimental hash-based CSP via `experimental.sri`, which would allow a strict `script-src 'self'` *and* static rendering. Worth revisiting once it leaves experimental.

### 16.5 XSS prevention

- Prompt text, titles and descriptions are rendered as **plain text React children**. `dangerouslySetInnerHTML` is banned repo-wide and enforced by an ESLint rule (`react/no-danger: error`).
- No Markdown/HTML rendering of user content in v1. If rich text is ever added, it goes through DOMPurify with a strict allowlist, sanitised **server-side on write**, not on read.
- Uploaded SVGs are sanitised before storage (§12.2).
- All external links use `rel="noopener noreferrer"`.
- The prompt block uses `white-space: pre-wrap` on a text node — never `innerHTML` — which is both safer and correct for preserving the timestamp formatting found throughout the source content.

### 16.6 SSRF prevention

`/api/image-proxy` and external-URL validation both:
- accept `https:` only;
- resolve the hostname and reject private, loopback, link-local and reserved IP ranges (IPv4 and IPv6);
- refuse to follow redirects (`redirect: 'manual'`), then re-validate any redirect target through the same guard;
- enforce a 10s timeout and a 15 MB response cap;
- require an `image/*` content type;
- never reflect upstream response headers to the client.

### 16.7 Secret hygiene

| Secret | Where it lives |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Server env only. **Never** `NEXT_PUBLIC_` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Server env only |
| `ADMIN_EMAILS` | Server env only. Bootstrap allowlist; the `admin` custom claim is the durable grant |
| Session signing | Handled by Firebase — `createSessionCookie` / `verifySessionCookie`. No secret of ours to manage |
| Firebase Web config (apiKey etc.) | `NEXT_PUBLIC_` is fine — it is a public identifier; rules and the session check do the enforcing |

A CI check greps the client bundle for R2/service-account key patterns and fails the build on a hit. `.env*` files are gitignored except `.env.example`.

### 16.8 Rate limiting

Upstash Redis (sliding window) in production, with an in-memory LRU fallback for local dev.

| Endpoint | Limit |
|---|---|
| `POST /api/admin/login` | 5 / 15 min / IP |
| `POST /api/admin/upload-url` | 30 / 10 min / session |
| `POST /api/admin/*` (writes) | 120 / 5 min / session |
| `POST /api/metric` | 60 / 1 min / IP |
| `GET /api/image-proxy` | 100 / 5 min / IP |
| `POST /api/csp-report` | 20 / 5 min / IP |

Cloudflare in front of the origin provides the DDoS and bot layer; Bot Fight Mode enabled, with a WAF rule rate-limiting `/admin*`.

### 16.9 Validation

Every API boundary parses input with **Zod**. Schemas are shared between client and server (`lib/schemas/`) so the editor's inline validation and the server's enforcement can never drift. Unknown keys are stripped (`.strict()`), not passed through. Firestore documents are written from the parsed object, never from a raw request body.

### 16.10 Operational

- Firestore daily backups (scheduled export to GCS), 30-day retention.
- R2 bucket versioning enabled; deletes are soft for 30 days.
- Structured server logs with request IDs. **No PII, no prompt text, and never a secret in a log line.**
- Admin action audit trail: `{ action, target, timestamp, ip, userAgent }` written to an `auditLog` collection (server-write only, never publicly readable).
- Dependencies: `pnpm audit --audit-level=high` blocks CI; Dependabot weekly; a committed lockfile with `--frozen-lockfile` in CI.
- A `SECURITY.md` with a disclosure contact.

---

## 17. Performance & Scale

### 17.1 The core idea

**Public traffic must not scale Firestore reads.** Every public page is statically generated or ISR-cached at the edge; the database is read at *build/revalidate* time, not per visitor.

```
   1,000,000 page views/month
              │
              ▼
   ┌────────────────────┐
   │  Vercel Edge CDN   │  ← ~99.9% of requests end here
   │  (static + ISR)    │
   └─────────┬──────────┘
             │ cache miss / revalidate only
             ▼
   ┌────────────────────┐
   │  Next.js server    │
   └─────────┬──────────┘
             │ ~hundreds of reads/month, not millions
             ▼
   ┌────────────────────┐        ┌─────────────────────┐
   │     Firestore      │        │  Cloudflare R2 CDN  │
   └────────────────────┘        │  (media, 0 egress)  │
                                 └─────────────────────┘
```

Practical effect: 1M page views costs roughly the same in Firestore as 10K, because reads are driven by admin edits, not by visitors.

### 17.2 Rendering strategy

| Route | Strategy |
|---|---|
| `/` | ISR, `revalidate: 3600` + on-demand tag |
| `/prompts` | ISR shell + client-side filtering over the search index |
| `/prompts/[slug]` | SSG via `generateStaticParams` + ISR fallback for new slugs |
| `/categories`, `/categories/[slug]` | ISR, `revalidate: 3600` |
| `/search`, `/saved` | Client-rendered (dynamic by nature) |
| `/admin/*` | Fully dynamic, `no-store`, never cached |

On-demand revalidation tags: `prompts`, `prompt:{slug}`, `category:{slug}`, `settings`, `search-index`. Publishing one prompt invalidates precisely what changed, not the whole site.

### 17.3 Media performance

- `next/image` with AVIF + WebP, correct `sizes` per breakpoint, `blurDataURL` placeholders.
- Above-the-fold hero media: `priority`. Everything else: `loading="lazy"` with `decoding="async"`.
- Masonry tiles reserve space from stored `width`/`height` → **CLS ≈ 0**.
- YouTube façades — no iframe until clicked. Saves ~700 KB per embed and several third-party connections.
- Long-lived immutable cache headers on R2 (keys are unique per object, so cache busting is free).

### 17.4 Bundle budget

| Asset | Budget |
|---|---|
| First-load JS (public routes) | ≤ 120 KB gzipped |
| Per-route JS | ≤ 40 KB gzipped |
| CSS | ≤ 25 KB gzipped |
| Search index (100 prompts) | ≤ 80 KB, fetched on intent only |

Enforced with `@next/bundle-analyzer` plus a CI size check. Heavy pieces (masonry layout engine, MiniSearch, the admin editor) are dynamically imported. `lucide-react` is tree-shaken via per-icon imports. **The entire admin bundle is code-split away from public routes** — a visitor never downloads a byte of admin code.

### 17.5 Counters at scale

Naive per-view Firestore writes would be the one thing that does scale with traffic. Instead:
- `POST /api/metric` accepts a batched `sendBeacon` payload and pushes to an Upstash Redis counter.
- A cron job (every 15 min) flushes Redis into Firestore with a single batched `FieldValue.increment` per prompt.
- Result: 1M views → a few hundred Firestore writes.

### 17.6 Budget estimate

| Service | Expected monthly cost at ~500K views |
|---|---|
| Vercel | $0 (Hobby) → $20 (Pro) |
| Firebase Firestore | $0 — comfortably inside the free tier given cached reads |
| Cloudflare R2 | ~$0.15 for 10 GB stored; **$0 egress** |
| Upstash Redis | $0 (free tier) |
| Domain | ~$12/year |
| **Total** | **≈ $0–20/month** |

---

## 18. SEO & Sharing

- Per-route `generateMetadata` with title template `%s · STS Prompt Library`.
- **Dynamic OG images** at `/api/og/[slug]` via `next/og`: the preview media as background, a scrim, the title, the AI tool badge and the site logo. Cached immutably.
- JSON-LD: `WebSite` + `SearchAction` on the home page; `CreativeWork` (with `about`, `keywords`, `thumbnailUrl`) on each prompt; `BreadcrumbList` on category and detail pages; `ItemList` on listing pages.
- `sitemap.ts` generated from published prompts and visible categories, with `lastModified` from `updatedAt`. `/admin/*` and `/api/*` excluded.
- `robots.ts` disallows `/admin`, `/api`, `/saved`.
- Canonical URLs on every page; filter permutations on `/prompts` are canonicalised to the base route to avoid index bloat.
- Semantic HTML: one `<h1>` per page, `<article>` per prompt, real `<nav>`/`<main>`/`<footer>` landmarks.
- Web Share API on the detail page with a clipboard fallback.

---

## 19. Accessibility

Target: **WCAG 2.2 Level AA**.

| Requirement | Implementation |
|---|---|
| Colour contrast | All tokens verified ≥ 4.5:1 body, ≥ 3:1 large text and UI, in both themes |
| Keyboard | Every interactive element reachable and operable; logical tab order; no traps |
| Focus visible | 2px `--accent` ring with a 2px offset — never `outline: none` without a replacement |
| Skip link | "Skip to content" as the first focusable element |
| Screen readers | Semantic landmarks; `aria-label` on icon-only buttons; live region for copy confirmations |
| Images | `alt` is a **required** field in the admin editor — publishing is blocked without it |
| Video | YouTube captions surfaced where available; the play façade has an accessible name |
| Motion | Full `prefers-reduced-motion` support across all animations |
| Touch targets | Minimum 44×44px on all mobile controls |
| Forms | Every input has a `<label>`; errors are associated via `aria-describedby` and announced |
| Zoom | Layout survives 200% zoom and 320px width without horizontal scroll |
| Modals/sheets | Focus trapped, `Esc` closes, focus returns to the trigger |

CI runs `axe-core` against key routes; violations fail the build.

---

## 20. Analytics

- **Vercel Analytics** (or Plausible) for privacy-friendly page views — no cookies, no consent banner needed.
- **First-party events** via `/api/metric`: `prompt_view`, `prompt_copy`, `prompt_save`, `search`, `filter_apply`, `install_prompt_shown`, `install_accepted`.
- **Zero-result search queries are logged** — this is the highest-signal input for deciding which prompts to add next.
- No third-party trackers, no fingerprinting, no personal data collected. IPs are used only transiently for rate limiting and are never stored.

---

## 21. Tech Stack

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| Runtime | Node.js | 22 LTS | Vercel default |
| Package manager | **pnpm** | 9.x | Fast, disk-efficient, strict, reproducible |
| Framework | Next.js (App Router, Turbopack) | **16.3** | ISR, RSC, route handlers, image optimisation, React Compiler |
| UI | React | 19.2 | |
| Language | TypeScript | 5.9, `strict: true` | |
| Styling | Tailwind CSS | v4 | CSS-first config, token-driven theming |
| Components | shadcn/ui + Radix | latest | Accessible primitives, owned source (no black box) |
| Icons | lucide-react | latest | Per-icon imports |
| Theme | next-themes | latest | No-flash SSR theming |
| Forms | react-hook-form + Zod | latest | Shared client/server schemas |
| DB | Firebase Firestore | v12 SDK | Requested |
| Admin DB | firebase-admin | latest | Server writes, bypasses rules |
| Storage | Cloudflare R2 via `@aws-sdk/client-s3` + `s3-request-presigner` | v3 | S3-compatible, zero egress |
| PWA | `@serwist/next` + `serwist` | latest | Maintained `next-pwa` successor |
| Search | minisearch | latest | Tiny, fast, client-side |
| Image processing | `sharp` (server), `browser-image-compression` (client) | latest | Resize, WebP, blur placeholders |
| Admin auth | **Firebase Authentication** | v12 SDK | Google + email/password → server-verified HttpOnly session cookie |
| Rate limit | `@upstash/ratelimit` + `@upstash/redis` | latest | Serverless-friendly |
| Animation | Motion (framer-motion) | latest | Reduced-motion aware |
| Toasts | sonner | latest | |
| Testing | Vitest + Testing Library + Playwright + `@firebase/rules-unit-testing` | latest | Unit, component, E2E, rules |
| Lint/format | ESLint 9 (flat) + Prettier | latest | |
| Hosting | Vercel | — | Native ISR + on-demand revalidation |
| CDN (media) | Cloudflare | — | R2 custom domain |

### Project structure

```
sts-prompt-library/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                   # Home
│   │   ├── prompts/page.tsx           # Browse
│   │   ├── prompts/[slug]/page.tsx    # Detail
│   │   ├── categories/page.tsx
│   │   ├── categories/[slug]/page.tsx
│   │   ├── search/page.tsx
│   │   ├── saved/page.tsx
│   │   ├── about/page.tsx
│   │   └── layout.tsx                 # Header, bottom nav, footer
│   ├── admin/
│   │   ├── login/page.tsx
│   │   ├── page.tsx                   # Dashboard
│   │   ├── prompts/…                  # list / new / [id] / preview
│   │   ├── categories/page.tsx
│   │   ├── tags/page.tsx
│   │   ├── media/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── import/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── layout.tsx                 # AdminShell (auth-guarded)
│   ├── api/…                          # route handlers (see §7.1)
│   ├── offline/page.tsx
│   ├── manifest.ts
│   ├── sitemap.ts
│   ├── robots.ts
│   ├── sw.ts                          # Serwist service worker
│   ├── layout.tsx                     # Root: theme script, fonts, providers
│   └── globals.css                    # Tailwind v4 + design tokens
├── components/
│   ├── ui/                            # shadcn primitives
│   ├── prompt/                        # PromptCard, PromptTextBlock, CopyButton…
│   ├── media/                         # MediaFrame, YouTubeEmbed, Dropzone
│   ├── layout/                        # Header, BottomNav, Footer, ThemeToggle
│   ├── filters/                       # FilterBar, FilterSheet, ChipRail
│   ├── search/                        # SearchOverlay, SearchResults
│   ├── admin/                         # AdminShell, PromptEditor, MediaLibrary…
│   └── pwa/                           # InstallPrompt, UpdateToast, OfflineBanner
├── lib/
│   ├── firebase/                      # client.ts, admin.ts, queries.ts, mutations.ts
│   ├── r2/                            # client.ts, presign.ts, delete.ts
│   ├── auth/                          # provider.ts, passcode-provider.ts, session.ts
│   ├── schemas/                       # Zod: prompt, category, settings, media
│   ├── search/                        # index-builder.ts, client-search.ts
│   ├── youtube/                       # parse.ts, oembed.ts, thumbnails.ts
│   ├── security/                      # rate-limit.ts, ssrf-guard.ts, sanitize-svg.ts
│   ├── utils/                         # slug.ts, cn.ts, format.ts, clean-text.ts
│   └── constants/                     # ai-tools.ts, aspect-ratios.ts, copy.ts
├── hooks/                             # useCopy, useSaved, useTheme, useInstallPrompt…
├── types/
├── public/  icons/ screenshots/
├── scripts/  build-search-index.ts, generate-icons.ts, seed.ts
├── tests/    unit/ e2e/ rules/
├── firestore.rules
├── firestore.indexes.json
├── middleware.ts
├── next.config.ts
├── tailwind.config.ts
├── .env.example
├── CLAUDE.md
└── PRD.md
```

---

## 22. Environment Variables

```bash
# ── Public (safe to expose in the client bundle) ──────────────────────
NEXT_PUBLIC_SITE_URL=https://stsprompts.com
NEXT_PUBLIC_CDN_URL=https://cdn.stsprompts.com

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ── Server only — NEVER prefix these with NEXT_PUBLIC_ ────────────────
FIREBASE_SERVICE_ACCOUNT_KEY=          # full JSON, base64-encoded

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=sts-prompt-library-media
R2_PUBLIC_URL=https://cdn.stsprompts.com

# Comma-separated emails allowed to hold the admin claim.
# Run `pnpm set:admin <email>` afterwards to grant the durable custom claim.
ADMIN_EMAILS=you@example.com

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

REVALIDATE_SECRET=                     # guards the revalidation webhook
```

A startup check parses `process.env` with a Zod schema and **fails fast** with a clear message if anything required is missing or malformed — far better than a runtime 500 three screens deep.

---

## 23. Delivery Milestones

| # | Milestone | Status | Delivered |
|---|---|---|---|
| **M0** | Foundation | ✅ **Done** | pnpm + Next 16.3 + React 19.2 + TS strict; Tailwind v4 OKLCH token system; three-way theme with no flash; split-CSP `proxy.ts`; security headers; Zod env validation; Firebase + R2 clients |
| **M1** | Data & auth | ✅ **Done** | Zod schemas (prompt, media, category, settings); `firestore.rules` + composite indexes; Firebase Auth session cookies + `requireAdmin`; queries/mutations layer with cache-tag invalidation and audit log; AdminShell, login, dashboard |
| **M2** | Admin + editor | ✅ **Done** | Prompts CRUD API; R2 presigned upload (browser→R2 direct, HEAD-verified); SSRF-guarded external image URLs; YouTube resolver with Shorts detection + override; full prompt editor with three-source media picker, live mobile/desktop × light/dark preview, autosave, OCR cleanup tool, publish flow |
| **M3** | Public surface | ✅ **Done** | Home, Browse (client-side filters, URL-synced), Categories + category detail, Prompt detail with sticky copy bar and JSON-LD, Search (MiniSearch), Saved (device-local), masonry grid, header/footer/bottom-nav, robots + sitemap |
| — | Content pipeline | ✅ **Done** | `pnpm extract:docx` (58 unique prompts recovered, duplicates and truncation detected) and `pnpm seed` |
| **M4** | PWA | ⬜ Next | Manifest, icon generation from the admin logo mark, Serwist service worker + caching strategies, offline page, install prompt (Android + iOS), update toast |
| **M5** | Remaining admin | ⬜ Next | Categories, Tags, Media library, Site settings (logos, accent, SEO), Import wizard, Analytics |
| **M6** | Metrics & search index | ⬜ | `/api/metric` + Redis→Firestore aggregation; prebuilt static search index served from CDN |
| **M7** | Hardening & launch | ⬜ | Firestore rules tests, Playwright E2E, axe pass, OG image route, Lighthouse ≥ 90/95, production deploy |

### Verified at the end of M3

```
Route (app)                     Revalidate  Expire
┌ ○ /                                   1h      1y
├ ○ /categories                         1h      1y
├ ● /categories/[slug]
├ ○ /prompts                            1h      1y
├ ● /prompts/[slug]
├ ○ /saved · ○ /search · ○ /sitemap.xml · ○ /robots.txt
├ ƒ /admin · ƒ /admin/login · ƒ /admin/prompts · ƒ /admin/prompts/[id] · ƒ /admin/prompts/new
└ ƒ /api/admin/*
```

**Every public route is Static (`○`) or SSG (`●`); every admin route is Dynamic (`ƒ`).** That is the §17 scaling contract holding — public traffic never touches Firestore.

Also verified against the running production build:

| Check | Result |
|---|---|
| `/`, `/prompts`, `/categories` | `200` |
| `/admin` unauthenticated | `307` → `/admin/login?next=%2Fadmin` |
| `POST /api/admin/prompts` unauthenticated | `401` |
| `POST /api/admin/upload-url` unauthenticated | `401` |
| Public CSP | `script-src 'self' 'unsafe-inline'` |
| Admin CSP | `script-src 'self' 'nonce-…' 'strict-dynamic'` |
| Admin headers | `X-Robots-Tag: noindex…`, `Cache-Control: no-store` |
| HSTS / nosniff / DENY / Referrer-Policy | all present |
| Unit tests | 68 passing |
| `pnpm typecheck` · `pnpm lint` | clean |

## 24. Decisions & Assumptions

All open questions from v1.0 have been answered by the owner and are now locked.

### 24.1 Answered — locked

| # | Question | Decision |
|---|---|---|
| Q1 | Brand name | **STS Prompt Library** (short name "STS Prompts"), under Skills To Salary |
| Q2 | Direct MP4 upload? | **No — YouTube only.** No video hosting, transcoding or bandwidth cost. The data model already supports adding it later without migration |
| Q3 | Attribution field? | **Yes, optional.** `attribution: { source, handle, url }` — renders as a "Source:" credit line on the detail page when present |
| Q4 | Launch content | **All at once**, then edit and extend from the admin panel. The seed imports everything as *drafts* so nothing half-finished goes live |
| Q5 | Admin authentication | **Firebase Authentication** (Google + email/password). Supersedes the passcode gate proposed in v1.0 |
| Q6 | Footer / social links | Sourced from skillstosalary.com. The exact profile URLs aren't published on the site, so they are **admin-editable settings fields** — fill them in under Settings → Social |

### 24.2 Standing assumptions

| # | Item | Decision | Reversible? |
|---|---|---|---|
| A1 | Public access | Completely open — no account, no gate, no rate limit on reading | Yes |
| A2 | One category per prompt | Simpler filters and cleaner URLs; `tags` provide the second axis | Yes — `categoryId` → `categoryIds` |
| A3 | Search | Client-side MiniSearch over the delivered list. Revisit at ~5,000 prompts | Yes |
| A4 | Favourites | Device-local (`localStorage`), no sync. Becomes account-synced if accounts are ever added | Yes |
| A5 | Caching model | Classic ISR (`generateStaticParams` + `revalidate` + `revalidateTag`), **not** Next 16 Cache Components — the stable path, and it matches publish-driven invalidation | Yes |
| A6 | CSP | Split by surface (§16.4) so public routes stay static | Yes — if `experimental.sri` matures |
| A7 | Source preview images | The 59 embedded images are Instagram/website screenshots with watermarks and status bars — **unusable**. Fresh preview media is required | No |
| A8 | Source metadata | All category/tool/date placeholders are empty. Classification is manual admin work | No |
| A9 | Truncated prompts | 13 prompts are cut off in the source `.docx` and need their full text pasted in before publishing | No |
| A10 | Hosting | Vercel, for first-class ISR and on-demand revalidation | Yes |
| A11 | Language | English only at launch; copy centralised so i18n is additive | Yes |

### 24.3 Still needed from the owner

1. **Production domain** — needed for the manifest, CSP, canonical URLs and the R2 custom domain. `stsprompts.com` is a placeholder throughout this document.
2. **Firebase project + R2 bucket credentials** — the app boots on placeholders today and shows a setup checklist on the admin dashboard until they're real.
3. **Social profile URLs** for the footer.
4. **Logo files** — light-background and dark-background versions, plus a square mark for the PWA icon.

## 25. Out of Scope / Future

**Phase 2 — Accounts** — Firebase Auth (Google + email), synced favourites, personal collections, submit-a-prompt with an admin moderation queue.

**Phase 3 — Community** — likes, "I used this" counts, remix/fork a prompt, creator profiles, weekly trending.

**Phase 4 — Power tools** — a prompt builder that fills placeholders through a guided form, variant generator, side-by-side comparison, a public read API, a browser extension that injects prompts into Veo/Sora/Midjourney, Web Push for new-prompt alerts, multi-language.

---

## Appendix A — Copy & Tone

Plain, confident, no hype. "Copy prompt", not "Unlock this AI power prompt". Never say "AI-powered" about the site itself — the *content* is for AI, the site is just a good library. Errors are honest and actionable: "That upload failed — the file is over 10 MB. Try a smaller image." not "An error occurred."

## Appendix B — Definition of Done (per feature)

1. Works at 320px, 390px, 768px, 1024px, 1440px.
2. Works in light and dark themes.
3. Keyboard navigable with visible focus.
4. Loading, empty and error states all designed and implemented.
5. No layout shift (CLS < 0.05).
6. Zod-validated at every API boundary.
7. Unit tests for logic, E2E for the critical path.
8. No new `console.log`; no new TypeScript `any`.
9. Lighthouse does not regress.
10. Reviewed against this PRD.

---

*End of document.*
