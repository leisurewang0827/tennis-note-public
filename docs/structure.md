# 파일이 어떻게 놓여 있나

세 앱 모두 `app.js` 하나에 전부 들어 있었습니다. 역할별로 나눴고,
지금 `app.js` 에는 `state` 와 부팅 코드, `bindEvents`, `initApp` 만 남았습니다.

| | 회원앱 | 코치앱 | 관리자 |
|---|---|---|---|
| `domain/` | 17개 4,629줄 | 15개 2,527줄 | 11개 8,686줄 |
| `views/` | 9개 2,664줄 | 8개 1,375줄 | 11개 6,296줄 |
| `actions/` | 6개 1,561줄 | 4개 1,070줄 | 8개 7,242줄 |
| `forms/` | 6개 949줄 | 2개 303줄 | 7개 2,816줄 |
| `data/` | 5개 1,728줄 | 4개 1,195줄 | 5개 1,826줄 |
| `events/` | 7개 745줄 | 2개 553줄 | 9개 2,551줄 |
| `ui/` | 3개 770줄 | 3개 432줄 | 5개 1,260줄 |
| `catalog.js` | 410줄 | 55줄 | 806줄 |
| `storage.js` | 325줄 | 196줄 | 297줄 |
| `settings.js` | 61줄 | 47줄 | 127줄 |
| **`app.js`** | **429줄** | **206줄** | **1,013줄** |

시작할 때는 각각 14,218 · 7,998 · 31,096줄이었습니다.

## 폴더가 뜻하는 것

**이름이 거짓이면 이어받는 사람이 속습니다.** 실제로 `domain/` 에 화면을 그리는
함수가 섞여 있어 8개를 옮긴 적이 있습니다.

| 폴더 | 넣는 것 | 넣지 말 것 |
|---|---|---|
| `domain/` | 값을 받아 판정해 돌려주는 것 | DOM·서버를 만지는 것 |
| `views/` | `render*` — 화면을 그리는 것, HTML 문자열을 만드는 것 | |
| `events/` | 리스너 등록. `bindEvents` 를 쪼갠 것 | |
| `data/` | 서버(Supabase)에 붙는 것 | |
| `actions/` | 사용자가 누른 것을 처리 (폼 제출·저장·요청) | |
| `forms/` | 폼 항목·표시를 서로 맞추는 것 (선택지 다시 채우기, 필드 숨기기) | 서버 호출 |
| `ui/` | 모달·시트·토스트를 여닫는 것 | |
| `storage.js` | `localStorage` 읽기·쓰기 | |
| `catalog.js` | 화면에 쓰는 고정 데이터 표 (리터럴만) | 계산·호출 |
| `settings.js` | 저장소 키·버전 문자열·크기 | |

`app.js` 에는 `state`, 부팅 코드, `bindEvents`, 시작점(`initApp` / `initCoachApp`)
만 남깁니다.

⚠ **관리자에서 `sync*` / `refresh*` 는 대부분 서버가 아니라 `forms/` 일을 합니다.**
이름으로 가르면 60개가 `data/` 로 잘못 들어갑니다. **"서버를 부르는가" 로 가르세요.**

⚠ **관리자에서 `Sheet` 는 바텀시트가 아니라 스프레드시트(붙여넣기)입니다.**
회원앱과 다릅니다. UI 신호로 쓰면 `ScheduleSheetPaste` 한 벌이 `ui/` 로 잘못 갑니다.

## 왜 호출부를 안 바꾸고 옮길 수 있나

`app.js` 는 **클래식 스크립트**로 실려서 최상위 `function` 선언이 곧 전역입니다.
나눈 파일들도 클래식 스크립트라 같은 전역 공간을 씁니다. 호출은 `app.js` 가
실행된 뒤에 일어나므로 이름은 그때 해석됩니다.

그래서 **옮긴 함수가 전역이나 DOM 을 참조해도 됩니다.**

⚠ **최상위 선언(`const`)은 다릅니다.** 로드 시점에 평가되므로 순수 리터럴만
옮기세요. `performance.now()` 나 `window.TennisNoteXxx` 를 읽는 것, 함수를 부르는
것은 남겨야 합니다. 평가 시점이 바뀝니다.

## 앱마다 스크립트 싣는 방식이 다릅니다

| | 방식 |
|---|---|
| 관리자 `index.html` | `defer` **없는** 일반 스크립트를 순서대로 |
| 회원앱·코치앱 `index.html` | `defer` |

**관리자에 `defer` 를 붙이면 `app.js` 보다 나중에 실행돼 깨집니다.**
그 파일이 있는 `index.html` 의 기존 줄을 보고 그대로 따라 쓰세요.

회원앱·코치앱의 `app.js` 는 `index.html` 이 **동적으로 주입**합니다. 일반 경로는
클래식 스크립트이고, 네이티브 셸의 임베디드 업그레이드 경로에서만
`type="module"` 입니다.

## 새 파일을 만들면 등록할 곳

빠뜨리면 그 파일만 안 실립니다.

| | 회원·코치앱 | 관리자 |
|---|---|---|
| `index.html` 스크립트 목록 | O | O |
| `service-worker.js` 의 `APP_SHELL` | O | — (관리자는 서비스워커가 없음) |
| `tests/script-load.test.js` | O | O |
| `tests/seam-scope.test.js` | O | O |
| `tests/seam-callback.test.js` | O | O |

`index.html` 목록과 `APP_SHELL` 목록은 **서로 같아야** 합니다.
(`app.js` 만 예외 — `index.html` 이 동적으로 주입해서 `<script src>` 로 안 잡힙니다.)

## `app/shared/` 의 예외 둘

`app/shared/` 파일은 IIFE 로 감싸고 `window.TennisNoteXxx` 로 내보내는 것이
규칙인데, 아래 둘은 **전역 함수 선언 그대로** 둡니다.

| 파일 | 누가 싣나 | 왜 IIFE 가 아닌가 |
|---|---|---|
| `tennisnote-escape-html.js` | 세 앱 전부 | 호출부를 안 바꾸려면 전역이어야 함 |
| `tennisnote-app-common.js` | 회원앱·코치앱 | 같음. 그리고 `global-scope` 검사가 이름 충돌을 볼 수 있음 |

⚠ **`tennisnote-app-common.js` 를 관리자에 싣지 마세요.** 관리자는 `$` 와 `$$` 를
`const` 화살표 함수로 선언해서, 이 파일의 `function` 선언과 만나면 **SyntaxError 로
페이지가 통째로 죽습니다.** `global-scope` 검사가 막습니다.

## 아직 안 나눈 파일

- **`app/admin/schedule-v2-admin.js` (4,144줄)** — 함수 156개가 전부 IIFE 안에
  있습니다. 다른 파일들과 구조가 달라 [docs/splitting.md](splitting.md) 방법이
  그대로 통하지 않습니다.
- **`app/shared/tennisnote-curriculum-catalog.js` (4,562줄)** — 함수 0개,
  순수 데이터 표입니다. **나눌 것이 없으니 그대로 두세요.**
