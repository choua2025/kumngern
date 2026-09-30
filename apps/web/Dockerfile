# syntax=docker/dockerfile:1.7
#
# Build from the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t income-expenses-web .
#
# Stages:  deps → build → runtime (nginx:alpine, static files only)
#          deps → dev              (docker-compose.yml, Vite dev server)

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=@income-expenses/web --workspace=@income-expenses/shared \
      --include-workspace-root=false

# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
WORKDIR /app/apps/web
# Type checking runs in CI; the image build only bundles.
RUN npx vite build

# ---------------------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1

# ---------------------------------------------------------------------------
FROM deps AS dev
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
