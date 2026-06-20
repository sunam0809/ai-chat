FROM node:24-slim AS base
RUN npm install -g pnpm@10
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

FROM base AS deps
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/chat-ui/package.json artifacts/chat-ui/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/chat-ui/ artifacts/chat-ui/
COPY tsconfig.base.json tsconfig.json ./
RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/chat-ui run build

FROM node:24-slim AS runner
RUN npm install -g pnpm@10
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/chat-ui/dist ./artifacts/chat-ui/dist
RUN mkdir -p artifacts/api-server/uploads
EXPOSE 10000
ENV NODE_ENV=production
ENV PORT=10000
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
