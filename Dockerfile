FROM node:20-slim AS builder

RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/chat-ui/ artifacts/chat-ui/

RUN pnpm install --no-frozen-lockfile

RUN NODE_ENV=production BASE_PATH=/ PORT=3000 pnpm --filter @workspace/chat-ui run build
RUN pnpm --filter @workspace/api-server run build

FROM node:20-slim

RUN apt-get update -y && apt-get install -y \
    gcc g++ \
    gcc-mingw-w64 g++-mingw-w64 \
    python3 \
    nasm \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/artifacts/api-server/dist/ artifacts/api-server/dist/
COPY --from=builder /app/artifacts/chat-ui/dist/ artifacts/chat-ui/dist/

RUN mkdir -p artifacts/api-server/uploads artifacts/api-server/compile_tmp

EXPOSE 10000
ENV NODE_ENV=production
ENV PORT=10000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
