#!/usr/bin/env bash
# Fishing Vessel 봇을 podman으로 실행하기 위한 Dockerfile / .dockerignore 생성 스크립트
#
# 사용법:
#   ./create-dockerfile.sh           # Dockerfile, .dockerignore 생성
#   ./create-dockerfile.sh --build   # 생성 후 이미지 빌드
#   ./create-dockerfile.sh --run     # 생성 + 빌드 + 컨테이너 실행
#
# 환경변수로 기본값 변경 가능:
#   IMAGE_NAME (기본: fishing-vessel)
#   CONTAINER_NAME (기본: fishing-vessel)
#   VOLUME_NAME (기본: fishing-vessel-data)
#   NODE_VERSION (기본: 24)

set -euo pipefail

cd "$(dirname "$0")"

IMAGE_NAME="${IMAGE_NAME:-fishing-vessel}"
CONTAINER_NAME="${CONTAINER_NAME:-fishing-vessel}"
VOLUME_NAME="${VOLUME_NAME:-fishing-vessel-data}"
NODE_VERSION="${NODE_VERSION:-24}"

MODE="${1:-}"

# ---------------------------------------------------------------------------
# Dockerfile
# ---------------------------------------------------------------------------
cat > Dockerfile <<EOF
# 자동 생성 파일: create-dockerfile.sh 로 다시 생성할 수 있습니다.

# ---------- build stage ----------
FROM docker.io/library/node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 prebuilt 바이너리를 못 받을 경우를 대비한 네이티브 빌드 도구
RUN apt-get update \\
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \\
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Prisma Client 생성 (generated/prisma)
RUN DATABASE_URL="file:/tmp/build.db" npx prisma generate

# ---------- runtime stage ----------
FROM docker.io/library/node:${NODE_VERSION}-bookworm-slim
WORKDIR /app

ENV NODE_ENV=prod \\
    DATABASE_URL=file:/app/data/bot.db

COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/data && chown node:node /app/data

USER node
VOLUME ["/app/data"]

# 시작 시 스키마를 DB에 반영한 뒤 봇 실행 (pm2 대신 podman 재시작 정책 사용)
CMD ["sh", "-c", "npx prisma db push && exec npx ts-node index.ts"]
EOF

# ---------------------------------------------------------------------------
# .dockerignore
# ---------------------------------------------------------------------------
cat > .dockerignore <<'EOF'
node_modules
generated
.git
.vscode
.idea
.env
.env.*
*.log
logs
prisma/bot.db
prisma/bot.db-journal
Dockerfile
.dockerignore
create-dockerfile.sh
EOF

echo "Dockerfile, .dockerignore 생성 완료"

# ---------------------------------------------------------------------------
# 선택: 빌드 / 실행
# ---------------------------------------------------------------------------
if [[ "$MODE" == "--build" || "$MODE" == "--run" ]]; then
    command -v podman >/dev/null 2>&1 || { echo "podman이 설치되어 있지 않습니다." >&2; exit 1; }
    podman build -t "$IMAGE_NAME" .
fi

if [[ "$MODE" == "--run" ]]; then
    [[ -f .env ]] || { echo ".env 파일이 없습니다. BOT_TOKEN, APPLICATION_ID 등을 설정하세요." >&2; exit 1; }
    podman rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    podman run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        --env-file .env \
        -e NODE_ENV=prod \
        -e DATABASE_URL=file:/app/data/bot.db \
        -v "$VOLUME_NAME":/app/data:Z \
        "$IMAGE_NAME"
    echo "컨테이너 실행됨. 로그 확인: podman logs -f $CONTAINER_NAME"
fi

if [[ -z "$MODE" ]]; then
    cat <<EOF

다음 명령으로 빌드/실행하세요:
  podman build -t $IMAGE_NAME .
  podman run -d --name $CONTAINER_NAME --restart unless-stopped \\
      --env-file .env -e NODE_ENV=prod -e DATABASE_URL=file:/app/data/bot.db \\
      -v $VOLUME_NAME:/app/data:Z $IMAGE_NAME
EOF
fi
