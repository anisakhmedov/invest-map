# syntax=docker/dockerfile:1
# Production image for the InvestMap web app. Build context: apps/web.
#   docker build --build-arg NEXT_PUBLIC_SITE_URL=https://invest.example.uz -t investmap-web .
# Building needs no database: pages read it at request time.

ARG NODE_VERSION=24

# ---- dependencies ----
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY . .
# Placeholder only so Prisma can load its schema; nothing connects during the build.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm exec prisma generate \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm build

# ---- tools: runs migrations and creates roles / the first admin (one-off) ----
FROM build AS tools
ENV NODE_ENV=production
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec tsx prisma/seed.ts"]

# ---- runtime ----
FROM node:${NODE_VERSION}-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
