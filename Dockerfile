# 자동 생성 파일: create-dockerfile.sh 로 다시 생성할 수 있습니다.

# ---------- build stage ----------
FROM docker.io/library/node:24-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 prebuilt 바이너리를 못 받을 경우를 대비한 네이티브 빌드 도구
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Prisma Client 생성 (generated/prisma). 실제 DB 경로는 실행 시 .env 로 전달됩니다.
RUN DATABASE_URL="file:/tmp/build.db" npx prisma generate

# ---------- runtime stage ----------
FROM docker.io/library/node:24-bookworm-slim
WORKDIR /app

ENV NODE_ENV=prod \
    HOME=/tmp

COPY --from=build --chown=node:node /app /app
USER node

# 시작 시 스키마를 DB에 반영한 뒤 봇 실행 (pm2 대신 podman 재시작 정책 사용)
CMD ["sh", "-c", "npx prisma db push && exec npx ts-node index.ts"]
