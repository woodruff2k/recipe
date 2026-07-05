# syntax=docker/dockerfile:1
# NOTE: build context is the MONOREPO ROOT (see docker-compose.yml).

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- Install ---
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --filter ./frontend... --frozen-lockfile

# --- Build (standalone output) ---
COPY frontend ./frontend
# NEXT_PUBLIC_* is inlined at build time → must be set here.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter ./frontend run build

# --- Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Monorepo standalone layout: standalone/{node_modules, frontend/server.js}.
COPY --from=base /repo/frontend/.next/standalone ./
COPY --from=base /repo/frontend/.next/static ./frontend/.next/static
COPY --from=base /repo/frontend/public ./frontend/public

EXPOSE 3000
CMD ["node", "frontend/server.js"]
