#!/usr/bin/env bash
#
# 배포 전 검증 전부를 한 번에 돌린다. CI 가 돌리는 것과 같다.
#
#   ./scripts/verify.sh
#
# 실제 키는 필요 없다. 아래 더미값은 형식만 맞으면 되고, 진짜 서버에
# 접속하지 않는다. 이미 환경변수가 설정돼 있으면 그쪽을 그대로 쓴다.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

: "${TENNISNOTE_SUPABASE_URL:=https://example.supabase.co}"
: "${TENNISNOTE_SUPABASE_PUBLISHABLE_KEY:=test-publishable-key-for-ci-only}"
: "${TENNISNOTE_PORTONE_STORE_ID:=test-store-id}"
: "${TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY:=test-tosspay-channel}"
: "${TENNISNOTE_PAYMENT_MODE:=multi}"
: "${TENNISNOTE_ALLOWED_PAYMENT_METHODS:=tosspay}"
: "${TENNISNOTE_BANK_TRANSFER_ENABLED:=true}"
export TENNISNOTE_SUPABASE_URL TENNISNOTE_SUPABASE_PUBLISHABLE_KEY \
  TENNISNOTE_PORTONE_STORE_ID TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY \
  TENNISNOTE_PAYMENT_MODE TENNISNOTE_ALLOWED_PAYMENT_METHODS \
  TENNISNOTE_BANK_TRANSFER_ENABLED

APP_SCRIPTS=(
  app/admin/app.js
  app/admin/schedule-v2-admin.js
  app/tennis-note-member-app/app.js
  app/tennis-note-coach-app/app.js
)

step() { printf "\n\033[1m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[31m✖ %s\033[0m\n" "$1" >&2; exit 1; }

command -v node >/dev/null || fail "node 가 필요합니다. Node 22 이상을 설치하세요."
command -v python3 >/dev/null || fail "python3 이 필요합니다."

step "테스트"
node --test "tests/**/*.test.js"

step "충돌 마커 검사"
# 병합 충돌을 9곳 세고 8곳만 푼 적이 있다. 남은 마커가 커밋까지 갔고,
# verify.sh 를 파이프 뒤에서 돌리는 바람에 실패가 가려졌다.
if git grep -nE "^(<{7} |={7}$|>{7} )" -- . >/dev/null 2>&1; then
  git grep -nE "^(<{7} |={7}$|>{7} )" -- . | head -5
  echo "✘ 충돌 마커가 남아 있습니다. 병합 충돌 목록(git diff --name-only --diff-filter=U)을 다시 보세요." >&2
  exit 1
fi
echo "  ok  마커 없음"

step "문법 검사"
for script in "${APP_SCRIPTS[@]}"; do
  node --check "$script"
  echo "  ok  $script"
done

step "코치 권한 회귀 검사"
# origin/main 에서 온 검사다. 코치가 남의 수업을 보게 되던 회귀를 막는다.
# 저쪽은 CI 워크플로에 직접 적었지만, 여기서는 검증 명령을 이 파일 한 곳에만 둔다.
node --check scripts/check_tennisnote_coach_scope_runtime.cjs
node scripts/check_tennisnote_coach_scope_runtime.cjs

step "배포본 빌드"
python3 scripts/build_cloudflare_pages.py --target member --output dist/member
python3 scripts/build_cloudflare_pages.py --target admin --output dist/admin

step "배포본 검사"
python3 scripts/check_cloudflare_build.py

printf "\n\033[32m✔ 전부 통과했습니다.\033[0m\n"
printf "  배포본을 띄워보려면: cd dist/member && python3 -m http.server 8000\n"
