FROM node:24-slim AS base
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY patches/ patches/ 2>/dev/null || true

FROM base AS deps
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY scripts/package.json scripts/ 2>/dev/null || true
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY tsconfig.base.json tsconfig.json ./
RUN pnpm --filter @workspace/api-server run build

FROM node:24-slim AS runner
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
RUN mkdir -p artifacts/api-server/uploads
EXPOSE 10000
ENV NODE_ENV=production
ENV PORT=10000
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
