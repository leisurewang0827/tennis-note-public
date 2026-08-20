# CLAUDE.md

Tennis Note 공개 저장소 작업 규칙입니다.

---

## 이 작업의 전제

지금 하는 일은 **회원·코치·관리자 세 앱을 동작 그대로 두고 정리하는 것**입니다.
저장소 소유자가 계속 유지보수하지 않고, 나중에 **비개발자에게 넘깁니다.**
아래 세 가지는 개별 작업 지시보다 우선합니다.

### 1. 동작을 바꾸지 않는다

기능 추가, UI 변경, "개선"은 하지 않습니다. 옮기고, 나누고, 이름 붙이는 것만 합니다.

- **고치기 전에 현재 동작을 테스트로 먼저 못박으세요.** 그 테스트가 통과하는 한
  정리는 안전합니다.
- **현재 동작이 잘못돼 보여도 그대로 기록하세요.** 예: `tests/ticket-state.test.js`의
  `[알려진 문제]`는 틀린 동작을 일부러 고정해 둔 것입니다.
- **버그를 발견하면 고치지 말고** 아래 "미리 알아둘 것"에 적으세요.
  정리와 수정을 같은 커밋에 섞지 마세요. 섞이면 무엇이 깨뜨렸는지 알 수 없습니다.

### 2. 비개발자가 이어받을 수 있어야 한다

- 검증은 **한 명령으로 끝나고** 통과·실패가 분명해야 합니다 (`./scripts/verify.sh`).
- 실패 메시지는 **무엇을 하라고 알려줘야** 합니다. 트레이스백만 띄우지 마세요.
- **사람이 순서를 외워야 하는 절차를 만들지 마세요.** 스크립트로 만드세요.
- 새 도구를 도입하려면 "설치 없이 되는가"를 먼저 보세요. `package.json` 없이
  `node --test`를 쓰는 이유입니다.

### 3. 규율이 아니라 구조로 막는다

- "잊지 말자"는 대책이 아닙니다. **잊을 수 없는 형태**로 바꾸세요.
  손으로 여러 곳을 맞춰야 하는 것(버전 5곳 등)은 자동화 대상입니다.
- **검사기가 못 잡은 사고가 나면, 고치기 전에 검사기부터 고치세요.**
  그래야 같은 사고가 두 번 안 납니다. 실제로 이렇게 두 번 늘렸습니다 —
  깨진 `<a>` 링크 검사, 버전 불일치 검사.

---

## 검증 명령

작업 전후로 돌리세요. 통과해야 끝난 것입니다. CI가 돌리는 것과 같습니다.

```bash
./scripts/verify.sh
```

테스트 → 문법 → 빌드 → 배포본 검사를 순서대로 돌립니다. **실제 키는 필요 없습니다.**

검사 항목은 `tests/` 아래 14개 파일과 `scripts/check_cloudflare_build.py` 입니다.

| 검사 | 막는 것 |
|---|---|
| `global-scope` | 같은 이름이 두 파일에 선언 (뒤엣것이 조용히 이김) |
| `script-load` | 로드 시점 `ReferenceError`. 각 앱 스크립트를 실제로 실행해 봄 |
| `event-binding` | `document` 리스너가 화면 파일로 샘 · `bindEvents` 호출 누락 |
| `bump-release` | 버전 스크립트가 모르는 자리가 새로 생김 |
| `seam-scope`·`seam-callback`·`undefined-identifiers` | 이음매 관련 (아래 참조) |
| `verify-env` | `verify.sh` 와 CI 워크플로의 환경변수가 어긋남 |
| `check_cloudflare_build.py` | 버전 불일치 · 깨진 링크 · 비밀키 유출 · 결제 설정 |

새 검증을 추가할 때는 `scripts/verify.sh`에만 넣으세요. CI 워크플로에 또 적으면
로컬과 CI가 어긋납니다.

## 화면으로 확인

```bash
python3 -m http.server 8000
```

| | |
|---|---|
| 회원앱 | http://localhost:8000/app/tennis-note-member-app/ |
| 코치앱 | http://localhost:8000/app/tennis-note-coach-app/ |
| 관리자 | http://localhost:8000/app/admin/ |

`config.local.js` 404는 정상입니다. 설정이 없으면 데모 모드로 떨어져
**실제 회원 데이터에 접속하지 않습니다.** 로그인 없이 보려면
관리자 `?demoAdmin=1`, 회원앱 `?curriculumPreview=1`.

**코치앱은 로그인 없이 볼 수 없습니다.** 코치 프로필이 없으면 회원앱으로
되돌려 보냅니다(기존 동작). 화면 대신 파일을 확인하려면 브라우저 콘솔에서
`fetch` 로 읽어 `new Function(...)` 으로 격리 실행해 보세요.

localhost에서는 서비스워커를 등록하지 않으므로 고친 파일이 바로 반영됩니다.

---

## 지금 파일이 어떻게 놓여 있나

세 앱을 역할별로 나눴습니다. 각 폴더가 뜻하는 것은 아래
"큰 파일을 쪼개는 방법" 에 있습니다.

| | 회원앱 | 코치앱 | 관리자 |
|---|---|---|---|
| `domain/` | 15개 2,687줄 | 14개 2,557줄 | 11개 3,254줄 |
| `views/` | 8개 2,381줄 | 7개 1,307줄 | 10개 5,225줄 |
| `events/` | 7개 745줄 | 2개 553줄 | 9개 2,507줄 |
| `data/` | 5개 1,779줄 | 4개 1,246줄 | 5개 1,826줄 |
| `forms/` | — | — | 4개 1,177줄 |
| `actions/` | 6개 1,566줄 | 4개 1,070줄 | 8개 7,242줄 |
| `ui/` | 2개 768줄 | 2개 443줄 | 5개 1,260줄 |
| `storage.js` | 338줄 | 209줄 | 297줄 |
| `catalog.js` | 410줄 | 55줄 | 806줄 |
| `settings.js` | 61줄 | 47줄 | 127줄 |
| `app/shared/` 공용 | 282+11줄 | 282+11줄 | 11줄 |
| **`app.js`** | **3,763줄** | **721줄** | **8,967줄** |

시작할 때는 각각 14,218 · 7,998 · 31,096줄이었습니다.
관리자에는 `schedule-v2-admin.js`(3,959줄)가 따로 있고 손대지 않았습니다.

`app.js` 는 클래식 스크립트로 실려서 **최상위 `function` 선언이 곧 전역** 입니다.
나눈 파일들도 클래식 스크립트라 같은 전역 공간을 씁니다. 그래서 호출부를
한 줄도 바꾸지 않고 옮길 수 있었습니다.

⚠ **관리자와 회원·코치앱은 스크립트 싣는 방식이 다릅니다.**
관리자 `index.html` 은 `defer` 없는 일반 스크립트를 순서대로 싣고,
회원·코치앱은 `defer` 를 씁니다. 관리자에 `defer` 를 붙이면 `app.js` 보다
나중에 실행돼 깨집니다. **그 파일이 있는 `index.html` 의 기존 줄을 보고
그대로 따라 쓰세요.**

회원앱·코치앱은 네이티브 셸에서만 `type="module"` 로도 실립니다
(`index.html` 의 임베디드 업그레이드 경로). 일반 브라우저는 클래식입니다.

---

## 이 저장소에서만 통하는 규칙

코드만 봐서는 알 수 없는 것들입니다. 어기면 실사용자에게 사고가 납니다.

### 버전은 손으로 올리지 마세요

버전은 11개 파일 273곳에 박혀 있습니다(파일을 나눌수록 늘어납니다). 하나라도
빠뜨리면 **그 파일만 옛 캐시에 남아 사용자가 옛 화면을 봅니다.**
스크립트가 전부 한 번에 바꿉니다.

```bash
./scripts/bump_release.py --next        # 끝자리 +1
./scripts/bump_release.py 1.0.380       # 버전 지정
./scripts/bump_release.py --next --dry-run   # 무엇이 바뀔지만 확인
```

바꾸는 곳: `release.json` · `tennisnote-release.js` · 각 `index.html`·`app.js` 의
`?v=` · 서비스워커 두 개의 `CACHE_NAME` 카운터.

**건드리지 않는 곳**은 네이티브 배포 때 따로 움직입니다. 이력에서도 늘 별도
커밋이었습니다.

- `release.json` 의 `nativePlatforms.*` (`preparedVersion`, `latestBuild` 등)
- `tennisnote-release.js` 의 `nativeShell.*` (`androidVersion` 등)

스크립트는 끝나고 **옛 버전이 남았는지 스스로 검사하고, 남으면 아무것도 쓰지
않고 멈춥니다.** 모르는 자리가 새로 생기면 그때 스크립트에 추가하세요.

`?v=notion-catalog-3` 처럼 세머버가 아닌 캐시 키는 대상이 아닙니다. 그 파일만
따로 무효화하려는 것이므로 손대지 마세요.

서비스워커의 `APP_SHELL` 목록과 `index.html`의 스크립트 목록도 일치해야 합니다.
스크립트를 추가·삭제하면 양쪽 다 고치세요.

### 사용자 입력은 반드시 escapeHtml을 거친다

`innerHTML` + 템플릿 문자열로 화면을 그리므로, 회원이 입력한 값을 그대로 넣으면
**그 자리에서 코드가 실행됩니다.** 실제로 회원 이름이 관리자 화면에서 실행되는
취약점이 있었습니다.

```js
`<strong>${member.name}</strong>`              // 안 됨
`<strong>${escapeHtml(member.name)}</strong>`  // 됨
`data-coach="${escapeHtml(coach.name)}"`       // 속성값도 마찬가지
```

대상: 이름, 닉네임, 전화번호, 거주 동네, 목표, 스타일 메모, 운동노트 본문,
코치 메모. 숫자나 코드에서 만든 고정 문자열은 감쌀 필요 없습니다.

**CSP의 `script-src`를 아직 조이지 못했으므로 이스케이프가 유일한 방어선입니다.**

### 앱 사이에 같은 코드를 두 벌 만들지 마세요

예전에는 회원앱과 코치앱에 글자까지 같은 함수가 20개 있었습니다.
한쪽만 고치면 다른 쪽이 깨진 채 남았습니다. **지금 두 앱 사이의 중복은 0입니다.**

공용 코드는 `app/shared/` 에 둡니다. 지금 있는 것:

| 파일 | 누가 싣나 | 무엇 |
|---|---|---|
| `tennisnote-escape-html.js` | 세 앱 전부 | `escapeHtml` — 유일한 XSS 방어선이라 한곳에서만 고치게 |
| `tennisnote-app-common.js` | 회원앱·코치앱 | 두 앱이 함께 쓰는 20개 (`$`, `showToast`, `syncLiveNotices` 등) |

⚠ **`tennisnote-app-common.js` 를 관리자에 싣지 마세요.** 관리자는 `$` 와
`$$` 를 `const` 화살표 함수로 선언해서, 이 파일의 `function` 선언과 만나면
**SyntaxError 로 페이지가 통째로 죽습니다.** `global-scope` 검사가 막습니다.

남은 중복은 세 개(13줄)뿐이고 서로 다른 짝이라 그냥 두었습니다 —
`numericValue`·`holdingRequestDays`(회원↔관리자), `saveSharedData`(코치↔관리자).
**고칠 일이 생기면 짝도 같이 고치세요.**

이름은 같은데 본문이 다른 것들(`renderAll`, `setView`, `bindDelegatedEvents`)은
앱마다 달라야 하는 것입니다. 페이지가 다르므로 이름이 겹쳐도 문제없습니다.

`app/admin/schedule-v2-admin.js` 와 `app/shared/tennisnote-ui-language.js`
안에도 `escapeHtml` 사본이 하나씩 더 있습니다. 둘 다 IIFE 안이라 전역 충돌은
없지만, 이스케이프를 강화한다면 그 둘도 같이 고쳐야 합니다.

### 서버는 이 저장소에 없다

브라우저가 `tn_users` 같은 테이블에 직접 접근합니다. **보안은 여기 코드가 아니라
Supabase RLS 정책이 책임집니다.** 스키마·RLS·엣지 함수는 `app-automation-vault`에
있습니다. 여기서 권한 검사를 추가해도 우회 가능합니다.

### 비밀키

`app/shared/config.local.js`는 배포 시 자동 생성되며 `.gitignore`에 있습니다.
직접 만들어 커밋하지 마세요.

- 브라우저에 들어가도 되는 것: Supabase `publishable`(anon) 키, PortOne `storeId`, 채널 키
- 절대 안 되는 것: Supabase `service_role` 키, PortOne API secret, 웹훅 secret

---

## 큰 파일을 쪼개는 방법

세 앱 모두 `app.js` 하나에 전부 들어 있었습니다. 역할별·화면별 파일로 나누는
중입니다. 지금까지 사고가 5건 났는데 **전부 아래 "쓰지 마세요" 쪽 방법과
병합 과정에서** 나왔습니다. "함수 통째로 옮기기"로는 한 건도 없었습니다.

### 지금 쓰는 방법 — 함수 통째로 옮기고 바이트 대조

1. 함수 본문을 **한 글자도 바꾸지 않고** 새 파일로 옮깁니다.
2. **되돌리기 검증**: 뗀 것을 제자리에 도로 넣으면 원본과 바이트 단위로 같은가.
   같으면 내용이 안 바뀌었다는 증명입니다.
3. `git show HEAD:...app.js` 와 대조해 **개수·본문·유실·중복** 을 확인합니다.
4. `./scripts/verify.sh` 를 돌립니다.
5. **브라우저로 봅니다.** 사고 5건이 전부 브라우저에서만 드러났습니다.
   자동 검사는 하나도 잡지 못했습니다.

함수의 끝은 **열 0 의 `}`** 로 찾습니다. "다음 `function` 선언 전까지"로 잡으면
사이의 최상위 코드까지 함수로 오인합니다 (실제로 사고를 냈습니다).

**왜 안전한가**: `app.js` 는 클래식 스크립트로 실려서 최상위 `function` 선언이
곧 전역입니다. 새 파일도 클래식 스크립트라 같은 전역 공간을 씁니다.
호출은 `app.js` 가 실행된 뒤에 일어나므로 이름은 그때 해석됩니다.
그래서 **옮긴 함수가 전역이나 DOM 을 참조해도 됩니다.**

⚠ **최상위 선언(`const`)은 다릅니다.** 로드 시점에 평가되므로 순수 리터럴만
옮기세요. `performance.now()` 나 `window.TennisNoteXxx` 를 읽는 것,
함수를 부르는 것은 남겨야 합니다. 평가 시점이 바뀝니다.

### 새 파일을 만들면 등록할 곳

빠뜨리면 그 파일만 안 실립니다.

| | 회원·코치앱 | 관리자 |
|---|---|---|
| `index.html` 스크립트 목록 | O | O |
| `service-worker.js` 의 `APP_SHELL` | O | — (없음) |
| `tests/script-load.test.js` | O | O |
| `tests/seam-scope.test.js` | O | O |
| `tests/seam-callback.test.js` | O | O |

`index.html` 목록과 `APP_SHELL` 목록은 **서로 같아야** 합니다.
관리자는 `defer` 를 쓰지 않습니다 (위 ⚠ 참조).

### 폴더가 뜻하는 것

이름이 거짓이면 이어받는 사람이 속습니다. 실제로 `domain/` 에 화면을 그리는
함수가 섞여 있어 8개를 옮긴 적이 있습니다.

| 폴더 | 넣는 것 | 넣지 말 것 |
|---|---|---|
| `domain/` | 값을 받아 판정해 돌려주는 것 | DOM·서버를 만지는 것 |
| `views/` | `render*` — 화면을 그리는 것 | |
| `events/` | 리스너 등록. `bindEvents` 를 쪼갠 것 | |
| `data/` | 서버(Supabase)에 붙는 것 | |
| `forms/` | 폼 항목·표시를 서로 맞추는 것 (관리자만) | 서버 호출 |
| `actions/` | 사용자가 누른 것을 처리 (폼 제출·저장·요청) | |
| `ui/` | 모달·시트·토스트를 여닫는 것 | |
| `storage.js` | `localStorage` 읽기·쓰기 | |
| `catalog.js` | 화면에 쓰는 고정 데이터 표 (리터럴만) | 계산·호출 |
| `settings.js` | 저장소 키·버전 문자열·크기 | |

`app.js` 에는 `state`, 시작점(`initApp`/`initCoachApp`), 아직 분류 못 한 것만
남깁니다.

### `bindEvents` 는 특별히 다룹니다

한 함수를 자르는 것이라 바이트 대조가 그대로는 안 됩니다. 대신 **조각을 원래
줄 순서로 도로 이으면 원본 본문과 같은가** 를 확인합니다.

`document`·`window` 리스너는 서로 순서가 얽히므로 **`delegated.js` 에 원래
순서 그대로** 모읍니다. 나머지는 서로 다른 요소라 순서가 결과를 바꾸지 않습니다.
`stopImmediatePropagation` 을 쓰면 이 전제가 무너집니다 — `event-binding`
검사가 막습니다.

### 쓰지 마세요 — 기본값 이음매 (사고 2건, 중단함)

전역을 매개변수로 바꾸되 기본값을 그 전역으로 두는 방식입니다.

```js
function f(candidate)                        // 이전
function f(candidate, allLessons = lessons)  // 이후
```

**102개 함수에 적용하고 멈췄습니다.** 시그니처가 바뀌어 바이트 대조를 할 수
없고, 그래서 두 번 사고가 났습니다. 위의 "함수 통째로 옮기기"로 충분하므로
새로 적용하지 마세요.

이미 적용된 것들이 남아 있어 검사 셋이 계속 지킵니다. **기존 이음매를 만질 때만**
아래를 지키세요.

⚠ 배열 메서드에 콜백으로 그대로 넘겨지던 함수는 깨집니다.
`map`/`flatMap`/`filter` 는 콜백에 `(요소, 인덱스, 배열)` 을 넘기므로,
매개변수를 추가하는 순간 **인덱스(숫자)가 이음매 자리에 들어갑니다.**

```js
branchMembers.flatMap(memberCoachNames)              // 깨진다
branchMembers.flatMap((m) => memberCoachNames(m))    // 이렇게 감싸야 한다
```

- **매개변수 이름은 `all` 로 시작합니다.** `tests/undefined-identifiers.test.js`
  가 이 접두사를 기준으로 검사합니다. 다른 이름을 쓰면 그 검사가 비켜갑니다.
- `tests/seam-callback.test.js` 가 콜백 문제를, `tests/seam-scope.test.js` 가
  이음매 이름이 함수 밖으로 새는 것을 검사합니다.

### 검출기를 믿지 마세요

**정규식으로 JS 를 정적 분석하다 지금까지 일곱 번 오분류했습니다.**
가장 최근은 전개 구문 `...name` 을 참조로 안 세서, 다른 파일의 값을
쓰는 상수를 먼저 실리는 파일에 넣어 로드 시점에 터뜨린 것입니다. 분류는
출발점일 뿐이고, 안전을 보장하는 건 바이트 대조와 브라우저 확인입니다.

## 코드 규칙

- 들여쓰기 2칸, 큰따옴표, 세미콜론. UI 문구와 주석은 한국어.
- **전역 함수 이름은 겹치면 안 됩니다.** 같은 페이지의 스크립트끼리 이름이 겹치면
  뒤에 로드된 쪽이 조용히 덮어씁니다. 현재 충돌 0건입니다.
- `app/shared/`의 파일은 IIFE로 감싸고 `window.TennisNoteXxx`로 내보냅니다.
  예외 둘: `tennisnote-escape-html.js` 와 `tennisnote-app-common.js` 는
  전역 함수 선언 그대로 둡니다. 그래야 앱들의 호출부를 안 바꾸고,
  `global-scope` 검사가 이름 충돌을 볼 수 있습니다. 파일 머리말에 적혀 있습니다.
- `localStorage` 키는 `tennis-note-` 접두사에 하이픈.

## 커밋

**`Publish Tennis Note PWA 1.0.x` 같은 커밋을 만들지 마세요.** 544개 중 363개가
그 형태라 언제 뭐가 왜 깨졌는지 추적할 수 없습니다.

변경 하나에 커밋 하나. 제목은 무엇을, 본문은 왜. 버전 올리기는 별도 커밋.

## 하지 말 것

- React·Vue·Next.js·TypeScript로 옮기지 마세요. 번들러나 `package.json`도 넣지 마세요.
- `renderAll()`을 새로 호출하는 코드를 늘리지 마세요. 관리자에만 57곳입니다.
  화면 전체를 다시 그려서 느려지고 입력 커서와 스크롤이 튑니다.
- `app/admin/app.js`(8,967줄)를 더 키우지 마세요. 새 기능은 별도 파일로.

## 미리 알아둘 것

지금 상태를 오해하지 않도록. 고칠 때 이 목록도 같이 지우세요.

- **`app/admin/app.js` 가 아직 큽니다(8,967줄).** 통째로 읽을 수 없으니
  필요한 부분만 찾아 읽으세요. 계층은 다 나눴고, 남은 것은 분류가
  애매한 함수 468개입니다.
- **관리자에 100줄 넘는 함수 18개가 남아 있습니다.** 가장 큰 것은
  `performAdminLiveDataSync`(796줄), `addLessonFromForm`(467줄) 입니다.
  DOM·서버·전역을 동시에 만져서 기계적으로 옮길 수 없습니다.
- **`app/tennis-note-legal/terms.html`이 없습니다.** 가입 동의 화면이 이 파일을
  링크해 404입니다. 링크 검사는 `check_cloudflare_build.py`의
  `KNOWN_MISSING_PAGES`로 통과시키고 있습니다. 만들면 거기서 지우세요.
- **개인정보처리방침이 두 벌입니다.** 루트 `privacy.html`이 정식본(시행일 7/18,
  처리자·연락처 있음), `app/tennis-note-legal/privacy.html`이 옛 초안인데
  **앱은 초안을 링크합니다.** `support.html`, `index.html`도 같은 상태입니다.
- **`remaining` 이 없거나 `null` 이면 이용권이 "소진"으로 판정됩니다.**
  `Number("") === 0` 이라 "잔여 0회"와 구분되지 않습니다. 지금은 모든 조회가
  `remaining_sessions` 를 포함해 터지지 않지만, DB 에 `NULL` 인 행이 있으면
  그 회원은 예약을 못 합니다. 현재 동작은 `tests/ticket-state.test.js` 의
  `[알려진 문제]` 에 기록돼 있습니다.
- **`app/shared/vendor/xlsx.full.min.js` 가 없습니다.** 엑셀 기능이 항상 외부
  CDN(jsdelivr)에 의존합니다.
- **루트의 `_headers` 는 GitHub Pages 에서 무시됩니다.** 실제로 적용되는 건
  `scripts/build_cloudflare_pages.py` 가 생성하는 쪽입니다.

## 로컬에서 로그인까지 테스트할 때

Supabase 허용 목록에 `http://127.0.0.1:8773/**` 가 등록돼 있습니다.
**그 포트와 호스트를 그대로 쓰세요.** `localhost` 와 `127.0.0.1` 은 브라우저
기준으로 다른 origin 이라, 어긋나면 Supabase 가 운영 사이트로 되돌려 보냅니다.

```bash
python3 -m http.server 8773 --bind 127.0.0.1
```

접속 설정(`app/shared/config.local.js`)은 배포본에서 받아올 수 있습니다.
`.gitignore` 대상이라 커밋에 영향 없습니다.

```bash
curl -s https://tennisnote-app.pages.dev/shared/config.local.js > app/shared/config.local.js
```

⚠️ 이 설정은 **운영 DB 에 붙습니다.** 읽기 위주로 확인하세요.
