# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# STS Prompt Library — production image
# Multi-stage: deps → builder → runner. Non-root, standalone Next.js bundle.
# Built for Dokploy (and any Docker Compose host).
#
# WHY DEBIAN AND NOT ALPINE
# `sharp` (image processing, used by next/image and the image-URL validator)
# loads a prebuilt native libvips binary. The glibc build is the best-tested
# path; musl needs the separate linuxmusl prebuilds and is a common source of
# "Could not load the sharp module" at runtime. ~50 MB more image for one less
# class of production-only failure.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22-bookworm-slim
ARG APP_PORT=3020


# ── Stage 1: deps ────────────────────────────────────────────────────────────
# Resolve a clean, lockfile-pinned tree. Cached until the manifests change.
FROM node:${NODE_VERSION} AS deps
RUN corepack enable && corepack prepare pnpm@11 --activate
WORKDIR /app

# pnpm-workspace.yaml carries the `allowBuilds` allowlist (sharp, protobufjs,
# esbuild, @firebase/util). Because those builds are pre-approved there, pnpm
# runs them non-interactively and does NOT raise ERR_PNPM_IGNORED_BUILDS — so
# unlike our other services this one does not need --ignore-scripts, and sharp
# gets its correct linux-x64 binary.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile


# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
RUN corepack enable && corepack prepare pnpm@11 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time — setting them
# as runtime env in the runner stage has no effect on the browser bundle.
# lib/env.ts validates them at import, so a missing value fails the build loudly
# rather than shipping a broken client.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

# OPTIONAL. Public pages are prerendered at build time, so without database
# access they build EMPTY and only fill in on the first ISR revalidation
# (revalidate = 3600). Passing the service account here makes the very first
# deploy serve real content immediately.
#
# Trade-off: build args are visible in `docker history`. On a private VPS
# building from private source that is usually acceptable; if it isn't, omit it
# and accept the delay, or trigger a revalidation after deploy.
ARG FIREBASE_SERVICE_ACCOUNT_KEY=""

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN pnpm build


# ── Stage 3: runner ──────────────────────────────────────────────────────────
# Only the standalone server, its traced node_modules, and static assets.
FROM node:${NODE_VERSION} AS runner
ARG APP_PORT
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=${APP_PORT} \
    HOSTNAME=0.0.0.0

# The node image already ships a non-root `node` user (uid 1000).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE ${APP_PORT}

# Uses node's global fetch rather than curl/wget — neither is installed in the
# slim image, and adding one just for a probe is wasted surface area.
# Hits /api/health, which never touches Firestore or R2: a third-party outage
# must not turn into a container restart loop.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
