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

## Architecture in one paragraph

Public pages are statically generated and revalidated on publish, so **visitor traffic never reads Firestore** — 1M page views costs roughly what 10K does. All writes go through server route handlers using the Admin SDK; Firestore rules deny every client write outright. Media uploads go browser → presigned URL → R2 without passing through the server. The admin panel sits behind Firebase Auth with an HttpOnly session cookie, verified independently on every page and every API route.
