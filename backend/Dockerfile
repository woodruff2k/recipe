# syntax=docker/dockerfile:1
# NOTE: build context is the MONOREPO ROOT (see docker-compose.yml),
# because the pnpm lockfile lives at the workspace root.

FROM node:20-alpine AS base
# Prisma engine needs OpenSSL on Alpine (musl).
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable
WORKDIR /repo

# --- Install (workspace-aware, cached on manifests) ---
# Copy every workspace manifest so the frozen lockfile validates, then install
# only the backend project's dependencies.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --filter ./backend... --frozen-lockfile

# --- Build ---
COPY backend ./backend
RUN pnpm --filter ./backend exec prisma generate \
 && pnpm --filter ./backend run build

ENV NODE_ENV=production
WORKDIR /repo/backend
RUN mkdir -p uploads
# Persist uploaded images (DB is the Postgres `db` service).
VOLUME ["/repo/backend/uploads"]
EXPOSE 4000

# Wait-free: Postgres is gated by compose healthcheck. Apply migrations, then start.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
