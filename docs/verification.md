# 검증

## 한 명령

```bash
./scripts/verify.sh
```

테스트 → 문법 → 배포본 빌드 → 배포본 검사를 순서대로 돕니다.
**실제 키는 필요 없습니다.** 통과해야 끝난 것입니다. CI 가 돌리는 것과 같습니다.

새 검증을 추가할 때는 `scripts/verify.sh` 에만 넣으세요. CI 워크플로에 또 적으면
로컬과 CI 가 어긋납니다 (`verify-env` 검사가 이걸 막습니다).

## 검사기가 각각 막는 것

**"문서에만 있는 규칙" 과 "검사기가 막는 규칙" 을 구분하세요.**
문서만 있는 규칙은 지켜지지 않습니다. 아래는 실제로 막히는 것들입니다.

| 검사 | 막는 것 | 실패하면 |
|---|---|---|
| `global-scope` | 같은 이름이 한 페이지의 두 파일에 선언 | 뒤에 로드된 쪽이 조용히 이깁니다. 옮기고 원본을 안 지웠는지 보세요 |
| `script-load` | 로드 시점 `ReferenceError`·TDZ. 각 앱 스크립트를 순서대로 **실제로 실행** | 최상위 코드가 아직 정의 안 된 이름을 참조합니다. 로드 순서나 옮긴 위치를 보세요 |
| `event-binding` | `document`·`window` 리스너가 화면 파일로 샘 · `stopImmediatePropagation` 사용 · `bindEvents` 호출 누락 | [docs/splitting.md](splitting.md#bindevents-는-특별히-다룹니다) 참조 |
| `bump-release` | 버전 스크립트가 모르는 자리가 새로 생김 | 스크립트가 파일·줄 번호를 짚어줍니다. [docs/releasing.md](releasing.md) 참조 |
| `seam-scope` | 이음매 이름이 함수 밖으로 샘 | [docs/splitting.md](splitting.md#기본값-이음매는-쓰지-마세요) 참조 |
| `seam-callback` | 이음매 함수를 배열 메서드 콜백으로 그대로 넘김 | 같음 |
| `undefined-identifiers` | 정의 없는 이음매 이름을 본문에서 사용 | 같음 |
| `verify-env` | `verify.sh` 와 CI 워크플로의 환경변수가 어긋남 | 로컬만 통과하거나 CI 만 통과합니다 |
| `admin-*` · `ticket-state` | 도메인 함수의 **현재 동작**을 고정 | 옮기다 뭔가 바뀌었거나, 의도한 변경이면 기대값을 갱신하세요 |
| `check_cloudflare_build.py` | 버전 불일치 · 깨진 링크 · 비밀키 유출 · 결제 설정 | 메시지가 무엇을 하라고 알려줍니다 |

`admin-values.test.js` 는 `app/admin/domain/values.js` 의 **함수 목록을 이름으로
고정**해 둡니다. 함수를 옮기거나 지우면 여기도 고쳐야 합니다. 실수로 사라지면
여기서 잡힙니다.

## 자동 검사로는 부족합니다

**구조를 정리하다 낸 사고 3건이 전부 브라우저에서만 드러났습니다.** 자동 검사는
로드 시점과 정적 구조만 봅니다. 함수 안에서 일어나는 일은 눌러봐야 압니다.

### 브라우저로 확인

```bash
python3 -m http.server 8773 --bind 127.0.0.1
```

| | |
|---|---|
| 회원앱 | http://127.0.0.1:8773/app/tennis-note-member-app/ |
| 코치앱 | http://127.0.0.1:8773/app/tennis-note-coach-app/ |
| 관리자 | http://127.0.0.1:8773/app/admin/ |

`config.local.js` 404 는 정상입니다. 설정이 없으면 데모 모드로 떨어져
**실제 회원 데이터에 접속하지 않습니다.**

로그인 없이 보려면 관리자 `?demoAdmin=1`, 회원앱 `?curriculumPreview=1`.

⚠ **코치앱은 로그인 없이 볼 수 없습니다.** 코치 프로필이 없으면 회원앱으로
되돌려 보냅니다(기존 동작). 화면 대신 파일을 확인하려면 콘솔에서 `fetch` 로 읽어
`new Function(...)` 으로 격리 실행해 보세요.

### 함수가 없다고 나오면 캐시부터 의심하세요

**파일 내용만 바꾸고 `?v=` 를 안 올리면 브라우저가 옛 파일을 씁니다.**
서비스워커 얘기가 아니라 평범한 HTTP 캐시입니다. 실제로 이것 때문에 코드
문제인 줄 알고 한참 찾은 적이 있습니다.

콘솔에서 아래를 돌리고 새로고침하세요.

```js
for (const s of [...document.querySelectorAll("script[src]")].map(e => e.getAttribute("src")))
  await fetch(s, { cache: "reload" });
```

### 오류를 놓치지 않으려면

콘솔을 열어두는 것보다 확실합니다. 페이지를 띄운 직후 콘솔에서:

```js
window.__err = [];
window.addEventListener("error", (e) => window.__err.push(e.message));
window.addEventListener("unhandledrejection", (e) => window.__err.push(String(e.reason?.message || e.reason)));
```

화면을 다 눌러본 뒤 `window.__err` 를 확인합니다.

## 로컬에서 로그인까지 테스트할 때

Supabase 허용 목록에 `http://127.0.0.1:8773/**` 가 등록돼 있습니다.
**그 포트와 호스트를 그대로 쓰세요.** `localhost` 와 `127.0.0.1` 은 브라우저 기준으로
다른 origin 이라, 어긋나면 Supabase 가 운영 사이트로 되돌려 보냅니다.

접속 설정은 배포본에서 받아올 수 있습니다. `.gitignore` 대상이라 커밋에 영향 없습니다.

```bash
curl -s https://tennisnote-app.pages.dev/shared/config.local.js > app/shared/config.local.js
```

⚠️ **이 설정은 운영 DB 에 붙습니다.** 읽기 위주로 확인하고, 저장·삭제를 눌러보려면
그 파일을 잠시 치워 데모 모드로 두세요.
