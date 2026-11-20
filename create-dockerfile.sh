#!/usr/bin/env bash
# Fishing Vessel 봇을 podman으로 실행하기 위한 Dockerfile / .dockerignore 생성 스크립트
#
# 사용법:
#   ./create-dockerfile.sh           # Dockerfile, .dockerignore, compose.yaml 생성
#                                    # 이후 podman compose up -d --build 로 실행 가능
#   ./create-dockerfile.sh --build   # 생성 후 이미지 빌드
#   ./create-dockerfile.sh --run     # 생성 + 빌드 + 컨테이너 실행
#
# 프로젝트 루트의 .env 에 아래 4개 값이 있어야 합니다.
#   BOT_TOKEN=...
#   APPLICATION_ID=...
#   GUILD_ID=...
#   DATABASE_URL=file:./prisma/fishing-vessel.db
#
# DATABASE_URL 의 상대 경로는 이 프로젝트(소스가 배포된 위치) 기준입니다.
# 컨테이너는 해당 폴더를 마운트하므로 DB 파일은 호스트의 그 위치에 생성됩니다.
#
# 환경변수로 기본값 변경 가능:
#   IMAGE_NAME (기본: fishing-vessel)
#   CONTAINER_NAME (기본: fishing-vessel)
#   NODE_VERSION (기본: 24)

set -euo pipefail

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

IMAGE_NAME="${IMAGE_NAME:-fishing-vessel}"
CONTAINER_NAME="${CONTAINER_NAME:-fishing-vessel}"
NODE_VERSION="${NODE_VERSION:-24}"
ENV_FILE="$PROJECT_DIR/.env"
REQUIRED_KEYS=(BOT_TOKEN APPLICATION_ID GUILD_ID DATABASE_URL)

# 컨테이너 안에서 DB 폴더가 마운트되는 경로
CONTAINER_DB_DIR="/data"

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
# Prisma Client 생성 (generated/prisma). 실제 DB 경로는 실행 시 .env 로 전달됩니다.
RUN DATABASE_URL="file:/tmp/build.db" npx prisma generate

# ---------- runtime stage ----------
FROM docker.io/library/node:${NODE_VERSION}-bookworm-slim
WORKDIR /app

ENV NODE_ENV=prod \\
    HOME=/tmp

COPY --from=build --chown=node:node /app /app
USER node

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
**/*.db
**/*.db-journal
**/*.db-wal
**/*.db-shm
Dockerfile
.dockerignore
compose.yaml
create-dockerfile.sh
EOF

echo "Dockerfile, .dockerignore 생성 완료"

# ---------------------------------------------------------------------------
# .env 읽기
# ---------------------------------------------------------------------------
# .env 에서 KEY 값을 읽는다 (export 접두어, 따옴표, CR 제거)
read_env() {
    local key="$1" line
    line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=" "$ENV_FILE" | tail -n 1 || true)"
    line="${line#*=}"
    line="${line%$'\r'}"
    line="$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
    if [[ "$line" =~ ^\"(.*)\"$ || "$line" =~ ^\'(.*)\'$ ]]; then
        line="${BASH_REMATCH[1]}"
    fi
    printf '%s' "$line"
}

load_env() {
    [[ -f "$ENV_FILE" ]] || { echo ".env 파일이 없습니다: $ENV_FILE" >&2; return 1; }

    local missing=() key value
    for key in "${REQUIRED_KEYS[@]}"; do
        value="$(read_env "$key")"
        if [[ -z "$value" ]]; then
            missing+=("$key")
        else
            export "$key=$value"
        fi
    done
    if (( ${#missing[@]} > 0 )); then
        echo ".env 에 다음 값이 비어 있습니다: ${missing[*]}" >&2
        return 1
    fi

    # DATABASE_URL -> 호스트 DB 파일 경로 (상대 경로는 프로젝트 기준)
    local db_path="${DATABASE_URL#file:}"
    db_path="${db_path%%\?*}"
    [[ "$db_path" == /* ]] || db_path="$PROJECT_DIR/${db_path#./}"

    HOST_DB_DIR="$(dirname "$db_path")"
    DB_FILE="$(basename "$db_path")"
    mkdir -p "$HOST_DB_DIR"
    HOST_DB_DIR="$(cd "$HOST_DB_DIR" && pwd)"
}

# podman run 인자 구성 (토큰 값은 명령줄에 노출하지 않고 현재 환경에서 전달)
build_run_args() {
    RUN_ARGS=(
        -d
        --name "$CONTAINER_NAME"
        --restart unless-stopped
        --env-file "$ENV_FILE"
        -e BOT_TOKEN
        -e APPLICATION_ID
        -e GUILD_ID
        -e "DATABASE_URL=file:${CONTAINER_DB_DIR}/${DB_FILE}"
        -v "${HOST_DB_DIR}:${CONTAINER_DB_DIR}:Z"
    )
    # rootless podman: 컨테이너 사용자를 호스트 사용자와 맞춰 DB 파일 권한 문제 방지
    if [[ "$(podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null || echo true)" == "true" ]]; then
        RUN_ARGS+=(--userns=keep-id --user "$(id -u):$(id -g)")
    fi
    RUN_ARGS+=("$IMAGE_NAME")
}

# podman compose 용 compose.yaml 생성 (load_env 이후 호출)
write_compose() {
    local volume_src="$HOST_DB_DIR"
    if [[ "$HOST_DB_DIR" == "$PROJECT_DIR" ]]; then
        volume_src="."
    elif [[ "$HOST_DB_DIR" == "$PROJECT_DIR"/* ]]; then
        volume_src="./${HOST_DB_DIR#"$PROJECT_DIR"/}"
    fi

    local user_block=""
    if [[ "$(podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null || echo true)" == "true" ]]; then
        user_block="    # rootless podman: 컨테이너 사용자를 호스트 사용자와 맞춰 DB 파일 권한 문제 방지
    userns_mode: keep-id
    user: \"$(id -u):$(id -g)\""
    fi

    cat > compose.yaml <<EOF
# 자동 생성 파일: create-dockerfile.sh 로 다시 생성할 수 있습니다.
services:
  bot:
    build: .
    image: ${IMAGE_NAME}
    container_name: ${CONTAINER_NAME}
    restart: unless-stopped
    env_file: .env
    environment:
      # .env 의 DATABASE_URL 을 컨테이너 내부 경로로 덮어씀
      DATABASE_URL: file:${CONTAINER_DB_DIR}/${DB_FILE}
    volumes:
      # 호스트 DB 폴더 -> 컨테이너 ${CONTAINER_DB_DIR}
      - ${volume_src}:${CONTAINER_DB_DIR}:Z
${user_block}
EOF
    echo "compose.yaml 생성 완료 (DB: ${HOST_DB_DIR}/${DB_FILE})"
}

# ---------------------------------------------------------------------------
# 선택: 빌드 / 실행
# ---------------------------------------------------------------------------
if [[ "$MODE" == "--build" || "$MODE" == "--run" ]]; then
    command -v podman >/dev/null 2>&1 || { echo "podman이 설치되어 있지 않습니다." >&2; exit 1; }
    podman build -t "$IMAGE_NAME" .
fi

if [[ "$MODE" == "--run" ]]; then
    load_env
    write_compose
    build_run_args
    podman rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    podman run "${RUN_ARGS[@]}"
    echo "컨테이너 실행됨. DB 위치: ${HOST_DB_DIR}/${DB_FILE}"
    echo "로그 확인: podman logs -f $CONTAINER_NAME"
fi

if [[ -z "$MODE" ]]; then
    echo
    if load_env; then
        write_compose
    fi
    echo "실행 방법:"
    echo "  podman compose up -d --build     # compose 사용"
    echo "  ./create-dockerfile.sh --run     # podman run 사용"
fi
