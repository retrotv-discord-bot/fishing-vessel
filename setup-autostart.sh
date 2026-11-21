#!/usr/bin/env bash
# 서버 재부팅 후에도 fishing-vessel 컨테이너가 자동으로 실행되도록 설정 (rootless podman)
#
# 사용법: 컨테이너를 실행할 사용자 계정으로, compose.yaml 이 있는 폴더에서
#   ./setup-autostart.sh
#
# 하는 일:
#   1. linger 활성화      : 로그아웃/재부팅 후에도 사용자 서비스가 실행되도록 함
#   2. podman-restart 등록: 부팅 시 restart=always 컨테이너를 자동 시작
#   3. 컨테이너 재생성    : 변경된 restart 정책(always) 적용

set -euo pipefail
cd "$(dirname "$0")"

CONTAINER_NAME="fishing-vessel"

if [[ "$EUID" -eq 0 ]]; then
    echo "root 가 아닌, 컨테이너를 실행할 사용자 계정으로 실행하세요." >&2
    exit 1
fi

if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
    echo "XDG_RUNTIME_DIR 이 설정되어 있지 않습니다." >&2
    echo "'sudo su' 대신 해당 사용자로 SSH 직접 로그인 후 실행하세요." >&2
    exit 1
fi

# 1. linger 활성화
if [[ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || echo no)" != "yes" ]]; then
    echo "[1/3] linger 활성화 (sudo 권한 필요)"
    sudo loginctl enable-linger "$USER"
else
    echo "[1/3] linger 이미 활성화됨"
fi

# 2. 부팅 시 restart=always 컨테이너를 시작하는 사용자 서비스 등록
echo "[2/3] podman-restart.service 등록"
systemctl --user enable podman-restart.service

# 3. 컨테이너 재생성 (restart: always 적용)
echo "[3/3] 컨테이너 재생성"
podman compose down
podman compose up -d --build

# 확인
echo
echo "linger        : $(loginctl show-user "$USER" -p Linger --value)"
echo "podman-restart: $(systemctl --user is-enabled podman-restart.service)"
echo "restart 정책  : $(podman inspect "$CONTAINER_NAME" --format '{{.HostConfig.RestartPolicy.Name}}')"
echo
echo "완료. 'sudo reboot' 후 'podman ps' 로 자동 실행을 확인해 보세요."
