FROM node:24-slim
WORKDIR /app
COPY artifacts/api-server/dist/ artifacts/api-server/dist/
COPY artifacts/chat-ui/dist/ artifacts/chat-ui/dist/
RUN mkdir -p artifacts/api-server/uploads
EXPOSE 10000
ENV NODE_ENV=production
ENV PORT=10000
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
