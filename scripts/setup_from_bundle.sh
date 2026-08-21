#!/usr/bin/env bash
# 깃 번들에서 작업 저장소를 만든다.
#
# 번들은 저장소 하나가 파일 하나에 들어 있는 것이라 푸시 없이 옮길 수 있다.
# 다만 클론한 뒤 손봐야 할 것이 몇 가지 있어서 매번 손으로 하면 빠뜨린다.
# 특히 --prune 을 빠뜨리면 이미 푸시한 것처럼 보인다 (아래 4단계 참고).
#
#   ./setup_from_bundle.sh [번들파일] [만들 폴더]
#
# 인자를 안 주면 스크립트 옆에서 가장 최근 .bundle 을 찾고,
# 폴더 이름은 tennis-note-public 으로 만든다.

set -euo pipefail

REMOTE_URL="${TENNISNOTE_REMOTE:-https://github.com/leisurewang0827/tennis-note-public.git}"
GIT_NAME="${TENNISNOTE_GIT_NAME:-dev.jsds}"
GIT_EMAIL="${TENNISNOTE_GIT_EMAIL:-dev.jsds@gmail.com}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bundle="${1:-}"
target="${2:-tennis-note-public}"

say()  { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m⚠\033[0m %s\n' "$1"; }
die()  { printf '\n\033[31m✘ %s\033[0m\n' "$1" >&2; exit 1; }

# ── 1. 필요한 것이 있는지 먼저 본다. 중간에 멈추면 상태가 어중간해진다.
say "준비 확인"
for cmd in git node python3; do
  command -v "$cmd" >/dev/null 2>&1 || die "$cmd 가 없습니다. 설치하고 다시 실행하세요."
  ok "$cmd $("$cmd" --version 2>&1 | head -1 | tr -d '\n')"
done

# ── 2. 번들을 찾고 검사한다.
say "번들 확인"
if [ -z "$bundle" ]; then
  # 최근 것부터 본다. macOS 와 리눅스 모두에서 도는 방법으로.
  bundle="$(ls -t "$here"/*.bundle 2>/dev/null | head -1 || true)"
  [ -n "$bundle" ] || die "$here 에서 .bundle 파일을 찾지 못했습니다. 경로를 인자로 주세요."
fi
[ -f "$bundle" ] || die "번들 파일이 없습니다: $bundle"
bundle="$(cd "$(dirname "$bundle")" && pwd)/$(basename "$bundle")"
ok "$(basename "$bundle")  ($(du -h "$bundle" | cut -f1))"

git bundle verify "$bundle" >/dev/null 2>&1 \
  || die "번들이 깨졌습니다. 옮기는 중에 잘렸을 수 있으니 다시 복사하세요."
ok "번들 무결성 확인"

# ── 3. 어느 브랜치를 꺼낼지 번들이 알고 있다. 이름을 박아두지 않는다.
branches="$(git bundle list-heads "$bundle" | awk '$2 ~ /^refs\/heads\// {sub(/^refs\/heads\//,"",$2); print $2}')"
count="$(printf '%s\n' "$branches" | grep -c . || true)"
if [ "$count" -eq 1 ]; then
  branch="$branches"
elif printf '%s\n' "$branches" | grep -qx "stabilize/phase-0"; then
  branch="stabilize/phase-0"
else
  die "번들에 브랜치가 여럿입니다. 어느 것인지 정할 수 없습니다:
$branches"
fi
ok "브랜치: $branch"

# ── 4. 클론. 이미 있는 폴더를 건드리지 않는다.
say "클론"
[ -e "$target" ] && die "'$target' 이 이미 있습니다. 다른 이름을 주거나 옮기고 다시 실행하세요."
git clone -b "$branch" "$bundle" "$target" --quiet
cd "$target"
ok "$(git rev-list --count HEAD)개 커밋  ·  HEAD $(git rev-parse --short HEAD)"

# ── 5. 원격을 깃허브로 돌린다.
#
#    ⚠ --prune 이 핵심이다. 번들에서 클론하면 origin/<브랜치> 라는 remote ref 가
#      남는데, 주소만 바꾸면 그 ref 가 그대로 살아 있어서 git branch -r 에 찍힌다.
#      깃허브에 없는데 이미 푸시한 것처럼 보인다.
say "원격 연결"
git remote set-url origin "$REMOTE_URL"
ok "origin → $REMOTE_URL"

if git fetch --prune --quiet origin 2>/dev/null; then
  ok "가져오기 완료 (유령 ref 정리됨)"
  behind="$(git rev-list --count HEAD..origin/main)"
  ahead="$(git rev-list --count origin/main..HEAD)"
  if [ "$behind" -eq 0 ]; then
    ok "저쪽(origin/main)을 다 따라잡았습니다"
  else
    warn "저쪽에 새 커밋이 ${behind}개 있습니다 — docs/merging.md 를 보고 병합하세요"
  fi
  ok "우리 작업 커밋 ${ahead}개"
else
  warn "깃허브에서 가져오지 못했습니다 (네트워크?). 나중에 아래를 직접 돌리세요:"
  warn "    git fetch --prune origin"
fi

# ── 6. 이 저장소에서만 쓰는 이름. 전역 설정은 건드리지 않는다.
say "커밋 이름"
git config user.name  "$GIT_NAME"
git config user.email "$GIT_EMAIL"
ok "$GIT_NAME <$GIT_EMAIL>  (이 저장소에만 적용)"

# ── 7. 실제로 도는지 확인한다. 여기까지 통과해야 옮겨진 것이다.
say "검사"
if ./scripts/verify.sh >/tmp/tennisnote-verify.$$ 2>&1; then
  ok "$(grep -oE '^ℹ tests [0-9]+' /tmp/tennisnote-verify.$$ | tail -1 | awk '{print $3}')개 전부 통과"
  rm -f /tmp/tennisnote-verify.$$
else
  warn "검사가 실패했습니다. 전체 출력: /tmp/tennisnote-verify.$$"
  tail -20 /tmp/tennisnote-verify.$$
  die "옮기는 중에 문제가 생겼을 수 있습니다."
fi

say "끝났습니다"
cat <<EOF
  cd $target

  먼저 읽을 것:  AGENTS.md
  일요일 문서:   인수인계.md
  끝내기 전에:   ./scripts/verify.sh
EOF
