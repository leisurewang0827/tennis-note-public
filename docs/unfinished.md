# 아직 안 된 것

**"다 됐다" 고 오해하지 않도록.** 고칠 때 이 목록도 같이 지우세요.

## 구조

- **`app/admin/schedule-v2-admin.js` (4,144줄)** — 함수 156개가 전부 IIFE 안에
  있습니다. 다른 파일들과 구조가 달라 [splitting.md](splitting.md) 방법이 그대로
  통하지 않습니다. **방향을 정하고 시작해야 합니다.**
- **기본값 이음매 102개가 남아 있습니다.** 새로 적용하지 말고, 만질 때만
  [splitting.md](splitting.md#기본값-이음매는-쓰지-마세요) 규칙을 지키세요.

## 남은 중복

세 개뿐이고 서로 다른 짝이라 그냥 두었습니다. **고칠 일이 생기면 짝도 같이 고치세요.**

| 함수 | 어디에 |
|---|---|
| `numericValue` · `holdingRequestDays` | 회원앱 ↔ 관리자 |
| `saveSharedData` | 코치앱 ↔ 관리자 |

`app/admin/schedule-v2-admin.js` 와 `app/shared/tennisnote-ui-language.js` 안에도
`escapeHtml` 사본이 하나씩 더 있습니다. 둘 다 IIFE 안이라 전역 충돌은 없지만,
**이스케이프를 강화한다면 그 둘도 같이 고쳐야 합니다.**

## 법무 · 문서

- **`app/tennis-note-legal/terms.html` 이 없습니다.** 가입 동의 화면이 이 파일을
  링크해 404 입니다. 링크 검사는 `check_cloudflare_build.py` 의
  `KNOWN_MISSING_PAGES` 로 통과시키고 있습니다. **만들면 거기서 지우세요.**
- **개인정보처리방침이 두 벌입니다.** 루트 `privacy.html` 이 정식본(시행일 7/18,
  처리자·연락처 있음), `app/tennis-note-legal/privacy.html` 이 옛 초안인데
  **앱은 초안을 링크합니다.** `support.html`, `index.html` 도 같은 상태입니다.

## 알려진 버그 (고치지 않고 기록해 둔 것)

- **`remaining` 이 없거나 `null` 이면 이용권이 "소진" 으로 판정됩니다.**
  `Number("") === 0` 이라 "잔여 0회" 와 구분되지 않습니다. 지금은 모든 조회가
  `remaining_sessions` 를 포함해 터지지 않지만, **DB 에 `NULL` 인 행이 있으면
  그 회원은 예약을 못 합니다.** 현재 동작은 `tests/ticket-state.test.js` 의
  `[알려진 문제]` 에 일부러 고정해 두었습니다.

## 운영 · 환경

- **`app/shared/vendor/xlsx.full.min.js` 가 없습니다.** 엑셀 기능이 항상 외부
  CDN(jsdelivr)에 의존합니다.
- **루트의 `_headers` 는 GitHub Pages 에서 무시됩니다.** 실제로 적용되는 건
  `scripts/build_cloudflare_pages.py` 가 생성하는 쪽입니다.
- **쓰기 경로는 로컬에서 검증하기 어렵습니다.** 운영 DB 밖에 없어서 저장·삭제를
  눌러보기 어렵습니다. **스테이징 Supabase 를 두면 이 병목이 사라집니다.**
- **커밋 이메일이 이 저장소에서만 다릅니다** (`.git/config`).
  새로 클론하면 전역 설정으로 돌아가므로 다시 지정해야 합니다.

## 검사기로 못 막는 것

[incidents.md](incidents.md#아직-검사기가-없는-위험) 참조.
