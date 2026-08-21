# 아직 안 된 것

**"다 됐다" 고 오해하지 않도록.** 고칠 때 이 목록도 같이 지우세요.

## 정해야 할 것 (사람이 결정)

아래는 **에이전트가 혼자 정하면 안 되는 것들**입니다. 결정이 나면 이 절을 지우고
해당 문서에 규칙으로 옮기세요.

### 1. 브랜치 · 배포 정책

**지금 상태**: `main` 에 푸시하면 **그 즉시 실서비스에 배포됩니다.**

```
.github/workflows/deploy-cloudflare-pages.yml   on: push: branches: [main]
.github/workflows/deploy-pages.yml              on: push: branches: [main]
```

그래서 기능 커밋이 곧 배포이고, "올려두고 확인" 이 불가능합니다.
운영 저장소는 `codex/*` 브랜치 → PR → `main` 으로 가는데, 그 PR 안에
**기능 변경과 버전 올리기가 한 커밋으로 섞여 있습니다**
(`Publish Tennis Note PWA 1.0.x`).

**검토 중인 안**: `dev` 브랜치를 두고 기능·수정은 `dev` 로, `main` 은
릴리스할 때만 (버전 올린 뒤 `dev` → `main` 머지 + 푸시).

**결정이 필요한 지점**: 운영 쪽 에이전트도 `dev` 를 쓸 것인가.

- **쓴다면** — `dev` 를 기본 브랜치로 바꾸고 `main` 에 보호 규칙(직접 푸시 금지)을
  걸면 **구조로 막힙니다.** 문서보다 확실합니다.
- **안 쓴다면** — `dev` 는 우리 쪽 작업 공간일 뿐이고, `main` 의 뒤섞인 커밋을
  머지하는 부담은 그대로입니다. 배포와 개발이 분리되는 이득만 남습니다.

⚠ **`dev` 를 만들면 CI 를 같이 넓혀야 합니다.** 지금은 직접 푸시에 대해
`main` 만 검사가 돕니다. `dev` 에 그냥 푸시하면 **검사가 하나도 안 돌아갑니다.**

```yaml
# .github/workflows/tennisnote-public-ci.yml
push:
  branches: [main]        # ← dev 를 추가해야 함
```

### 2. 구조 정리를 채택할지

⚠ **채택해서 `main` 에 넣으면 아래 둘을 지우세요.**

| 지울 것 | 왜 |
|---|---|
| `docs/merging.md` | "저쪽은 app.js 한 덩어리, 우리는 쪼갠 파일" 이라는 격차를 푸는 절차입니다. 구조가 `main` 에 들어가면 그 격차가 없어집니다 |
| `scripts/merge_report.py` | 같은 이유. "저쪽이 고친 함수 → 우리 쪽 위치" 를 매핑하는 도구인데, 위치가 같아지면 할 일이 없습니다 |

같이 고칠 곳: `AGENTS.md` 의 안내 표에서 병합 줄, `docs/incidents.md` 의
`merging.md` 링크.

**남겨두면 나중에 없는 문제를 풀려고 합니다.** 이건 낡은 문서가 아니라
틀린 지시가 됩니다.



`app.js` 를 폴더별로 나눈 작업이 아직 `origin` 에 올라가지 않았습니다
(커밋 수는 `git rev-list --count origin/main..HEAD` 로 보세요). 채택하면 그 브랜치를 올리고, 안 하면 되돌립니다.
**이 결정 전에는 브랜치 이름을 바꾸거나 푸시하지 마세요** — 되돌릴 여지가 사라집니다.

### 3. `schedule-v2-admin.js` 를 어떻게 할지

4,196줄이고 함수 178개가 IIFE 안에 있습니다. 나누려면 다른 방법이 필요합니다.
그대로 두는 것도 선택지입니다.

## 구조

- **`app/admin/schedule-v2-admin.js` (4,196줄)** — 함수 178개가 전부 IIFE 안에
  있습니다. 다른 파일들과 구조가 달라 [splitting.md](splitting.md) 방법이 그대로
  통하지 않습니다. **방향을 정하고 시작해야 합니다.**
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
- **쓰기 경로는 로컬에서 검증하기 어렵습니다.** 운영 DB 밖에 없어서 저장·삭제를
  눌러보기 어렵습니다. **스테이징 Supabase 를 두면 이 병목이 사라집니다.**
- **커밋 이메일이 이 저장소에서만 다릅니다** (`.git/config`).
  새로 클론하면 전역 설정으로 돌아가므로 다시 지정해야 합니다.

## 검사기로 못 막는 것

[incidents.md](incidents.md#아직-검사기가-없는-위험) 참조.
