#!/bin/sh
# 컨테이너 시작/종료 처리
#   시작: 필수 환경변수 확인 -> prisma db push -> npm run start
#   종료: SIGTERM/SIGINT 수신 시 npm run stop
set -e

# .env 로 전달되어야 하는 필수 값 확인
for key in BOT_TOKEN APPLICATION_ID GUILD_ID DATABASE_URL; do
    eval "value=\${$key:-}"
    if [ -z "$value" ]; then
        echo "환경변수 $key 가 설정되지 않았습니다. .env 를 확인하세요." >&2
        exit 1
    fi
done

# 스키마를 DB에 반영 (DB 파일이 없으면 생성)
npx prisma db push

LOGS_PID=""
stopped=0
shutdown() {
    [ "$stopped" -eq 1 ] && return
    stopped=1
    echo "종료 신호 수신: npm run stop 실행"
    npm run stop || true
    if [ -n "$LOGS_PID" ]; then
        kill "$LOGS_PID" 2>/dev/null || true
    fi
    exit 0
}
trap shutdown TERM INT

# pm2 로 봇 실행 (pm2 는 백그라운드 데몬으로 동작)
npm run start

# 컨테이너가 바로 종료되지 않도록 pm2 로그를 포그라운드로 출력하며 대기
npx pm2 logs --raw &
LOGS_PID=$!
wait "$LOGS_PID" || true
shutdown
