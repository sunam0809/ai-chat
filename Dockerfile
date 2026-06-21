FROM node:24-slim

ARG BUILD_DATE=unknown
ENV COREPACK_ENABLE_STRICT=0
RUN npm install -g pnpm@10 --force

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/ lib/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/chat-ui/package.json artifacts/chat-ui/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @workspace/chat-ui run build
RUN pnpm --filter @workspace/api-server run build

RUN mkdir -p artifacts/api-server/uploads

EXPOSE 10000
ENV NODE_ENV=production
ENV PORT=10000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
