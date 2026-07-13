# 构建前端
FROM oven/bun:1.3.13 AS web-build
WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache
COPY VERSION /app/VERSION
COPY CHANGELOG.md /app/CHANGELOG.md
COPY web ./
RUN bun run build

# 构建服务端依赖
FROM oven/bun:1.3.13 AS server-build
WORKDIR /app/server
COPY server/package.json server/bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --cache-dir=/root/.bun/install/cache --production
COPY server ./

# 运行：单进程 Hono 服务 API + 静态前端
FROM oven/bun:1.3.13
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV STATIC_DIR=/app/web/dist
COPY --from=server-build /app/server /app/server
COPY --from=web-build /app/web/dist /app/web/dist
WORKDIR /app/server
EXPOSE 3000
VOLUME ["/data"]
CMD ["bun", "run", "src/index.ts"]
