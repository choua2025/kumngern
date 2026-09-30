# syntax=docker/dockerfile:1.7
#
# Build from the REPO ROOT (monorepo: the API depends on packages/shared):
#   docker build -f apps/api/Dockerfile -t income-expenses-api .
#
# Stages:  base → deps → build ─┐
#          base → prod-deps ────┴→ runtime   (small, non-root, production deps only)
#          base → deps → migrate            (Prisma CLI: `prisma migrate deploy`, seed)
#          base → deps → dev                (docker-compose.yml, hot reload)
#
# The Prisma CLI (~250 MB with its dependencies) lives only in the `migrate` image, so the
# long-running API image stays small.

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
# Only the manifests: this layer (and npm ci) is cached until a package.json changes.
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# ---------------------------------------------------------------------------
FROM base AS deps
# Toolchain for native addons (bcrypt) in case no prebuilt binary matches.
RUN apk add --no-cache python3 make g++
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=@income-expenses/api --workspace=@income-expenses/shared \
      --include-workspace-root=false

# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# shared → dist, then api: `prisma generate` (prebuild) + tsc
RUN npm run build --workspace=@income-expenses/shared \
 && npm run build --workspace=@income-expenses/api

# ---------------------------------------------------------------------------
FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --omit=optional --omit=peer \
      --workspace=@income-expenses/api --workspace=@income-expenses/shared \
      --include-workspace-root=false
# Why three --omit flags: @prisma/client lists the Prisma CLI as an optional PEER dependency,
# so the lockfile marks the CLI and its whole tree as "devOptional" (dev OR optional).
# npm only drops such packages when BOTH dev and optional are omitted — with --omit=dev
# alone, ~200 MB of CLI, Studio and TypeScript would ship in the production image.
# Known limitation: `npm ci --workspace` still installs a few hoisted packages of the web
# workspace (react-dom, d3-*, ~8 MB) as "extraneous"; `npm prune` does not remove them.
# npm hoists everything it can; make sure the folder exists for the COPY below either way.
RUN mkdir -p apps/api/node_modules
# @prisma/client ships a query compiler for every database it supports (~50 MB).
# We only talk to PostgreSQL; the generated client imports just that one.
RUN rm -f node_modules/@prisma/client/runtime/*sqlserver* \
          node_modules/@prisma/client/runtime/*mysql* \
          node_modules/@prisma/client/runtime/*sqlite* \
          node_modules/@prisma/client/runtime/*cockroachdb*

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
WORKDIR /app

# Production dependencies only (no TypeScript, no test tools, no compilers).
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
# The workspace package the API imports at runtime (symlinked from node_modules).
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
# The API itself: compiled JS + what `prisma migrate deploy` needs.
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist

# Attachment storage (Phase 13) — a Docker volume is mounted here.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

# Never run as root: a compromised process cannot modify the image or the host easily.
USER node
WORKDIR /app/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" > /dev/null || exit 1

# Exec form: node is PID 1 and receives SIGTERM directly (graceful shutdown in server.ts).
# Wrapping it in `npm start` or `sh -c` would swallow the signal.
CMD ["node", "dist/server.js"]

# ---------------------------------------------------------------------------
FROM deps AS migrate
ENV NODE_ENV=production
COPY tsconfig.base.json ./
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/tsconfig.json apps/api/
# The seed script imports the generated client.
RUN npm run db:generate --workspace=@income-expenses/api
USER node
WORKDIR /app/apps/api
# Default: apply pending migrations, then upsert reference data (currencies, system
# categories) that every environment needs. `... migrate npm run db:seed` adds demo users.
CMD ["npm", "run", "db:release"]

# ---------------------------------------------------------------------------
FROM deps AS dev
ENV NODE_ENV=development
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run db:generate --workspace=@income-expenses/api
WORKDIR /app/apps/api
EXPOSE 3000
# Apply migrations, then hot-reload. Source folders are bind-mounted by docker-compose.yml.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx watch --conditions=development src/server.ts"]
