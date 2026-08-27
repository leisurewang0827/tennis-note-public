# 아직 안 된 것

**"다 됐다" 고 오해하지 않도록.** 고칠 때 이 목록도 같이 지우세요.

## 구조 전환에서 아직 실행할 것

운영 방침은 확정됐습니다. 구조는 이 브랜치를 채택하고, 모든 개발·검증은 `dev`,
운영 배포는 승인된 `dev` → `main` PR로만 진행합니다.

원격 전환 전에 남은 일:

- 원격 `dev` 브랜치 생성과 CI 확인
- 저장소 기본 브랜치를 `dev` 로 변경
- `main` 직접 푸시 금지와 필수 검사 보호 규칙 설정
- 구조 변경을 `main` 에 처음 반영한 뒤 `docs/merging.md`와 `scripts/merge_*.py` 제거
- 제거와 함께 `AGENTS.md`·`docs/incidents.md`의 낡은 병합 안내 갱신

이 항목은 저장소 설정과 운영 배포를 바꾸므로 각각 승인 후 실행합니다.

## 구조

- **`app/admin/schedule-v2-admin.js` (4,554줄)** — 함수 196개가 전부 IIFE 안에
  있습니다. 다른 파일들과 구조가 달라 [splitting.md](splitting.md) 방법이 그대로
  통하지 않습니다. Phase 0에서는 그대로 두고 실제 유지보수 병목이 확인될 때
  ES 모듈 전환을 별도 작업으로 검토합니다.
- **`app.js` 에 폴더로 갔어야 할 함수 90개가 남아 있습니다.** 관리자 20 · 회원앱 48
  · 코치앱 22. 병합할 때마다 저쪽 신규 함수가 여기 쌓인 것입니다.
  회원앱 48개는 대부분 구매 흐름(`purchase*`)이고, 관리자·코치앱은 결제와
  수업 기록 쪽입니다. **주제가 뚜렷한 덩어리부터 가르면 됩니다** —
  1.0.398 의 공개 온보딩 30개를 그렇게 처리했습니다.
  `app-js-budget` 검사가 **더 늘어나는 것만** 막습니다. 줄이는 것은 사람 몫이고,
  줄이면 그 검사의 budget 도 같이 낮추세요.
- **`ui/`·`forms/` 에 서버 호출 6곳이 남아 있습니다.** 관리자 `ui/billing.js` 4,
  `ui/schedule.js` 1, `ui/common.js` 1. `layer-boundaries` 는 `domain/`·`views/`
  만 봅니다. 저쪽이 만든 환불 흐름이라 옮기려면 손이 큽니다.
- **기본값 이음매 61개가 남아 있습니다.** 새로 적용하지 말고, 만질 때만
  [splitting.md](splitting.md#기본값-이음매는-쓰지-마세요) 규칙을 지키세요.

## 남은 중복

세 개뿐이고 서로 다른 짝이라 그냥 두었습니다. **고칠 일이 생기면 짝도 같이 고치세요.**

| 함수 | 어디에 |
|---|---|
| `numericValue` · `holdingRequestDays` | 회원앱 ↔ 관리자 |
| `saveSharedData` | 코치앱 ↔ 관리자 |

`escapeHtml` 은 정본(`app/shared/tennisnote-escape-html.js`) 말고도 사본이 **셋**
더 있습니다 — `app/admin/schedule-v2-admin.js`, `app/shared/tennisnote-ui-language.js`,
`app/shared/tennisnote-issue-reporter.js`. 넷 다 IIFE 안이라 전역 충돌은 없고 지금은
같은 다섯 글자(`& < > " '`)를 막지만 **구현이 제각각입니다.**
**이스케이프를 강화한다면 셋을 같이 고쳐야 합니다.**

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
- **서울 개발 Supabase와 Cloudflare 개발 도메인을 분리했습니다.** 익명 fixture를
  사용하는 저장·삭제 검증은 개발계에서 수행할 수 있습니다. OAuth 공급자,
  Edge Function, 실제 결제·푸시는 의도적으로 연결하지 않았으므로 이 경로는
  운영 기능 확인용이 아닙니다. 운영 반영은 승인된 `dev` → `main` PR 뒤에만 합니다.
- **커밋 이메일이 이 저장소에서만 다릅니다** (`.git/config`).
  새로 클론하면 전역 설정으로 돌아가므로 다시 지정해야 합니다.

## 검사기로 못 막는 것

[incidents.md](incidents.md#아직-검사기가-없는-위험) 참조.
