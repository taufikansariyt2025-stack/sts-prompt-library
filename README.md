# STS Prompt Library

A public library of AI **image** and **video** prompts — each one shown with the real output it produces. Free, no sign-up, installable as an app.

Built for [Skills To Salary](https://skillstosalary.com).

- **[PRD.md](PRD.md)** — product spec: screens, data model, design system, security
- **[CLAUDE.md](CLAUDE.md)** — engineering guide: rules, architecture, gotchas

---

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS v4 · Firebase (Firestore + Auth) · Cloudflare R2 · pnpm

---

## Setup

### 1. Install

```bash
pnpm install
```

### 2. Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Firestore Database** → create in production mode.
3. **Authentication** → enable **Google** and **Email/Password**.
4. **Project settings → General** → add a Web app, copy the config into `.env.local`.
5. **Project settings → Service accounts** → *Generate new private key*.

```bash
# base64 keeps newlines intact when pasting into a hosting env UI
base64 -i service-account.json | pbcopy
```

Deploy the rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 3. Cloudflare R2

1. Create a bucket (e.g. `sts-prompt-library-media`).
2. **Do not** enable the public `r2.dev` URL. Bind a **custom domain** instead — that is what puts media behind Cloudflare's CDN with zero egress.
3. Create an API token with Object Read & Write.
4. Add a CORS rule allowing `PUT` from your origin:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

> Uploads failing silently in the browser is almost always a missing CORS rule.

### 4. Environment

```bash
cp .env.example .env.local
```

Fill in every value. The app validates them at startup and fails fast with a readable message rather than a mystery 500.

### 5. Content + admin

```bash
pnpm extract:docx          # source .docx → scripts/data/extracted-prompts.json
pnpm seed                  # categories, settings, and all prompts as drafts
pnpm set:admin you@example.com
pnpm dev
```

Open [localhost:3000/admin](http://localhost:3000/admin), sign in, and work through the drafts — set the category, AI tool and preview media, then publish.

---

## Commands

```bash
pnpm dev            pnpm build          pnpm start
pnpm typecheck      pnpm lint           pnpm test
pnpm check          # typecheck + lint + test — run before committing
pnpm analyze        # bundle analyzer
```

---

## About the source content

The `.docx` in `prompt-docs/` contains **58 unique prompts** (93 blocks, the rest duplicates). Three things worth knowing:

1. **13 prompts are truncated in the source itself** at ~1,024 characters, cut off mid-sentence. They're flagged during import and need their full text pasted in before publishing.
2. **All metadata is empty** — the `Category • AI Tool • Date` line is unfilled on every entry, so classification is manual.
3. **The 59 embedded images are unusable** as previews — they're Instagram screenshots with status bars and watermarks. Upload fresh preview media, or paste a YouTube link.

Content is ~85% video and heavily skewed to 9:16, so the UI is built vertical-first.

---

## Deploying to Dokploy

The repo ships a multi-stage `Dockerfile` (deps → builder → runner) producing a
non-root standalone image, plus a `docker-compose.yml` with the Traefik labels
Dokploy's Compose deploys need.

### Use the **Compose** deployment type

1. Dokploy → **Create → Compose**, point it at this repo, Compose path `./docker-compose.yml`.
2. Dokploy → **Environment** → paste every value from `.env.example`, including `DOMAIN`.
3. Point your DNS A record at the VPS, then **Deploy**.

Traefik issues the Let's Encrypt certificate automatically and redirects HTTP → HTTPS.

### The one thing that catches people out

`NEXT_PUBLIC_*` variables are **baked into the browser bundle at build time**, which
is why they appear under both `build.args` and `environment` in the compose file.
Changing one requires a **rebuild** — restarting the container will not pick it up.

`lib/env.ts` validates them at import, so a missing value fails the build with a
readable message instead of shipping a broken client.

### First deploy renders empty pages unless you do this

Public routes are prerendered at build time. If the build can't reach Firestore,
they build empty and only fill in on the first ISR revalidation (up to an hour).
Passing `FIREBASE_SERVICE_ACCOUNT_KEY` as a build arg (already wired up) makes the
first deploy serve real content immediately.

Trade-off: build args are visible in `docker history`. On a private VPS building
from private source that's usually fine — if it isn't for you, drop the build arg
and accept the delay.

### Notes

| | |
|---|---|
| Container port | `3020`, internal only. Never publish a host port on a shared Dokploy VPS |
| Base image | Debian `bookworm-slim`, **not** Alpine — `sharp` loads its glibc libvips prebuild far more reliably than the musl one |
| Health check | `GET /api/health`, which deliberately never touches Firestore or R2 so a third-party outage can't cause a restart loop |
| Rate limiting | Falls back to an in-memory limiter without Upstash — per-container, so set `UPSTASH_*` before running more than one replica |

Local sanity check without Dokploy:

```bash
docker compose build && docker compose up
```

---

## Architecture in one paragraph

Public pages are statically generated and revalidated on publish, so **visitor traffic never reads Firestore** — 1M page views costs roughly what 10K does. All writes go through server route handlers using the Admin SDK; Firestore rules deny every client write outright. Media uploads go browser → presigned URL → R2 without passing through the server. The admin panel sits behind Firebase Auth with an HttpOnly session cookie, verified independently on every page and every API route.
