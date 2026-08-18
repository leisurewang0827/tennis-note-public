# CLAUDE.md

Tennis Note 공개 저장소 작업 규칙입니다.

---

## 검증 명령

작업 전후로 돌리세요. 통과해야 끝난 것입니다. CI가 돌리는 것과 같습니다.

```bash
./scripts/verify.sh
```

테스트 → 문법 → 빌드 → 배포본 검사를 순서대로 돌립니다. **실제 키는 필요 없습니다.**

검사 항목: 버전 일치 · 깨진 링크 · 비밀키 유출 · 결제 설정 · 서비스워커 캐시 이름.

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
관리자 `?demoAdmin=1`, 회원앱 커리큘럼 `?curriculumPreview=1`.

localhost에서는 서비스워커를 등록하지 않으므로 고친 파일이 바로 반영됩니다.

---

## 이 저장소에서만 통하는 규칙

코드만 봐서는 알 수 없는 것들입니다. 어기면 실사용자에게 사고가 납니다.

### 버전은 다섯 군데가 같이 움직인다

하나라도 빠뜨리면 **그 파일만 옛 캐시에 남아 사용자가 옛 화면을 봅니다.**

1. `app/release.json` — 기준 원본
2. `app/shared/tennisnote-release.js` — `version`, `releaseId`, `appSurfaceVersion`
3. 각 `index.html`의 `?v=` (9개 파일 73곳)
4. `app/tennis-note-member-app/service-worker.js` — `CACHE_NAME`
5. `app/tennis-note-coach-app/service-worker.js` — `CACHE_NAME`

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

### 회원 앱과 코치 앱은 코드가 중복돼 있다

이름까지 같은 함수가 32개, 10줄 단위로 같은 블록이 211개입니다.
**한쪽을 고쳤으면 반드시 다른 쪽도 확인하세요.**
새 공용 로직은 `app/shared/`에 두세요.

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

## 코드 규칙

- 들여쓰기 2칸, 큰따옴표, 세미콜론. UI 문구와 주석은 한국어.
- **전역 함수 이름은 겹치면 안 됩니다.** 같은 페이지의 스크립트끼리 이름이 겹치면
  뒤에 로드된 쪽이 조용히 덮어씁니다. 현재 충돌 0건입니다.
- `app/shared/`의 파일은 IIFE로 감싸고 `window.TennisNoteXxx`로 내보냅니다.
- `localStorage` 키는 `tennis-note-` 접두사에 하이픈.

## 커밋

**`Publish Tennis Note PWA 1.0.x` 같은 커밋을 만들지 마세요.** 460개 중 380개가
그 형태라 언제 뭐가 왜 깨졌는지 추적할 수 없습니다.

변경 하나에 커밋 하나. 제목은 무엇을, 본문은 왜. 버전 올리기는 별도 커밋.

## 하지 말 것

- React·Vue·Next.js·TypeScript로 옮기지 마세요. 번들러나 `package.json`도 넣지 마세요.
- `renderAll()`을 새로 호출하는 코드를 늘리지 마세요. 이미 123곳입니다.
  화면 전체를 다시 그려서 느려지고 입력 커서와 스크롤이 튑니다.
- `app/admin/app.js`(31,096줄)를 더 키우지 마세요. 새 기능은 별도 파일로.

## 미리 알아둘 것

지금 상태를 오해하지 않도록. 고칠 때 이 목록도 같이 지우세요.

- **파일이 큽니다.** `app/admin/app.js`는 약 356,000토큰이라 **통째로 읽을 수
  없습니다.** 필요한 부분만 찾아 읽으세요.
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
