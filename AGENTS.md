# AGENTS.md

Tennis Note 공개 저장소에서 작업하는 AI 에이전트(Codex, Claude 등)를 위한 규칙입니다.
사람이 읽어도 됩니다. **작업 시작 전에 전부 읽으세요.**

---

## 이 저장소가 뭔가

테니스 레슨 운영 서비스의 **프론트엔드 전부**입니다. 앱이 세 개 들어 있습니다.

| 경로 | 무엇 | 배포 주소 |
|---|---|---|
| `app/tennis-note-member-app/` | 회원 앱 (PWA) | https://tennisnote-app.pages.dev/ |
| `app/tennis-note-coach-app/` | 코치 앱 | 회원 사이트 하위 경로 |
| `app/admin/` | 관리자 웹 | https://tennisnote-admin.pages.dev/ |
| `app/shared/` | 세 앱이 같이 쓰는 코드 | — |
| `app/tennis-note-legal/` | 약관·방침 페이지 | — |

**서버는 이 저장소에 없습니다.** 데이터베이스 스키마, RLS 정책(행 단위 접근 권한),
엣지 함수는 별도 저장소(`app-automation-vault`)의 Supabase 쪽에 있습니다.
브라우저가 `tn_users` 같은 테이블에 직접 접근하므로, **보안은 여기 코드가 아니라
그쪽 RLS 정책이 책임집니다.** 여기서 권한 검사를 추가해도 우회 가능하다는 뜻입니다.

빌드 도구가 없습니다. `package.json`도, 번들러도, ES 모듈도 없습니다.
`<script>` 태그로 전역 공간에 올라가는 순수 자바스크립트입니다. 이 방식을 바꾸지 마세요.

---

## 절대 어기면 안 되는 것

### 1. 버전은 다섯 군데가 같이 움직인다

배포 버전이 아래 다섯 곳에 따로 박혀 있습니다. **하나라도 빠뜨리면 실제 사용자가
옛 화면을 봅니다.**

1. `app/release.json` — 기준이 되는 원본
2. `app/shared/tennisnote-release.js` — `version`, `releaseId`, `appSurfaceVersion`
3. 각 `index.html`의 `?v=` 쿼리 (현재 9개 파일 73곳)
4. `app/tennis-note-member-app/service-worker.js` — `CACHE_NAME` (`...-v405`)
5. `app/tennis-note-coach-app/service-worker.js` — `CACHE_NAME` (`...-v379`)

**서비스워커의 `APP_SHELL` 목록과 `index.html`의 스크립트 목록이 일치해야 합니다.**
스크립트를 추가·삭제하면 양쪽 다 고치세요.

`scripts/check_cloudflare_build.py`가 1~3번 불일치를 잡습니다. 반드시 돌려보세요.

> 이걸 자동화하는 `scripts/bump_release.py`는 아직 없습니다. 만들면 이 절이 짧아집니다.

### 2. 사용자가 입력한 값은 반드시 escapeHtml을 거친다

이 코드베이스는 `innerHTML` + 템플릿 문자열로 화면을 그립니다.
**회원이 입력한 값을 그대로 넣으면 그 자리에서 코드가 실행됩니다.**
실제로 회원 이름이 관리자 화면에서 실행되는 취약점이 있었습니다.

```js
// 안 됨
`<strong>${member.name}</strong>`

// 됨
`<strong>${escapeHtml(member.name)}</strong>`
```

속성값도 마찬가지입니다: `data-coach="${escapeHtml(coach.name)}"`.
(HTML 파싱 때 다시 디코드되므로 `dataset`으로 읽는 값은 그대로입니다.)

사용자가 직접 수정하는 값: 이름, 닉네임, 전화번호, 거주 동네, 목표, 스타일 메모,
운동노트 본문, 코치 메모, 코치·회원 이름 전반.
숫자나 코드에서 만든 고정 문자열은 감쌀 필요 없습니다.

`script-src`를 아직 조이지 못했습니다(인라인 스크립트 4개, 인라인 핸들러 3개에 의존).
**즉 CSP가 막아주지 않으므로 이스케이프가 유일한 방어선입니다.**

### 3. 회원 앱과 코치 앱은 코드를 공유한다

두 앱에 이름까지 같은 함수가 32개 중복돼 있습니다(`escapeHtml`, `saveSnapshot`,
`loadSharedData`, `showToast`, `localDateKey` 등). 10줄 단위로 똑같은 블록이 211개입니다.

**둘 중 하나를 고쳤으면 반드시 다른 쪽도 확인하세요.** 한쪽만 고치면 버그가 남습니다.
새로 만드는 공용 로직은 `app/shared/`에 두고 두 앱이 같이 쓰게 하세요.

### 4. 비밀키는 절대 커밋하지 않는다

`app/shared/config.local.js`는 배포할 때 자동 생성되며 `.gitignore`에 있습니다.
**직접 만들어 커밋하지 마세요.**

브라우저에 들어가도 되는 것: Supabase `publishable`(anon) 키, PortOne `storeId`,
채널 키. 절대 안 되는 것: Supabase `service_role` 키, PortOne API secret,
웹훅 secret, 회원 개인정보, 결제 기록.

---

## 작업 전후에 돌릴 것

```bash
# 1) 문법
node --check app/admin/app.js
node --check app/admin/schedule-v2-admin.js
node --check app/tennis-note-member-app/app.js
node --check app/tennis-note-coach-app/app.js

# 2) 빌드 + 검사 (실제 키 필요 없음, CI와 같은 더미값)
export TENNISNOTE_SUPABASE_URL=https://example.supabase.co
export TENNISNOTE_SUPABASE_PUBLISHABLE_KEY=test-publishable-key-for-ci-only
export TENNISNOTE_PORTONE_STORE_ID=test-store-id
export TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY=test-tosspay-channel
export TENNISNOTE_PAYMENT_MODE=tosspay_only
export TENNISNOTE_ALLOWED_PAYMENT_METHODS=tosspay

python3 scripts/build_cloudflare_pages.py --target member --output dist/member
python3 scripts/build_cloudflare_pages.py --target admin  --output dist/admin
python3 scripts/check_cloudflare_build.py
```

`check_cloudflare_build.py`가 검사하는 것:
버전 일치 · 깨진 링크(`a`/`img`/`script`/`link`) · 비밀키 유출 ·
결제 설정 · 서비스워커 캐시 이름.

### 화면으로 확인하기

```bash
python3 -m http.server 8000
```

- 회원앱 http://localhost:8000/app/tennis-note-member-app/
- 코치앱 http://localhost:8000/app/tennis-note-coach-app/
- 관리자 http://localhost:8000/app/admin/

`config.local.js` 404는 정상입니다. 설정이 없으면 데모 모드로 떨어지므로
**실제 회원 데이터에 접속하지 않습니다.** 로그인 없이 보려면
관리자는 `?demoAdmin=1`, 회원앱 커리큘럼은 `?curriculumPreview=1`을 붙이세요.

localhost에서는 서비스워커를 등록하지 않으므로 고친 파일이 바로 반영됩니다.

---

## 코드 규칙

- **들여쓰기 2칸, 큰따옴표, 세미콜론.** 기존 파일 스타일을 그대로 따르세요.
- **한국어 UI 문구**를 씁니다. 코드 주석도 한국어로 씁니다.
- **함수는 짧게.** `app/admin/app.js`는 함수 1,209개 중 100줄 넘는 게 33개뿐입니다.
  파일은 커도 함수는 잘게 쪼개져 있습니다. 그 습관을 유지하세요.
- **전역 함수 이름은 겹치면 안 됩니다.** 같은 페이지에 올라가는 스크립트끼리
  이름이 겹치면 뒤에 로드된 쪽이 조용히 덮어씁니다. 현재 충돌은 0건입니다.
- **`app/shared/`의 파일은 즉시실행함수(IIFE)로 감싸고 `window.TennisNoteXxx`로
  내보냅니다.** 기존 파일을 참고하세요.
- **`localStorage` 키는 `tennis-note-` 접두사에 하이픈**으로 씁니다.
  (`tennisnote_admin_layout_v1`처럼 밑줄을 쓴 예전 키가 하나 남아 있는데 예외입니다.)

---

## 커밋

**"Publish Tennis Note PWA 1.0.x" 같은 커밋을 만들지 마세요.**
전체 460개 커밋 중 380개가 그 형태라, 언제 뭐가 왜 깨졌는지 추적할 수 없습니다.

- 변경 하나에 커밋 하나. 여러 기능을 한 커밋에 묶지 마세요.
- 제목은 **무엇을 고쳤는지**, 본문은 **왜 그랬는지**를 씁니다.
- 배포용 버전 올리기는 기능 변경과 **별도 커밋**으로 합니다.

---

## 하지 말 것

- **React·Vue·Next.js·TypeScript로 옮기지 마세요.** 지금 구조가 잘 돌아가고 있고,
  운영자가 이해하고 있는 구조입니다.
- **번들러나 `package.json`을 도입하지 마세요.**
- **`renderAll()`을 새로 호출하는 코드를 늘리지 마세요.** 이미 화면 전체를
  다시 그리는 호출이 123곳(관리자 46, 코치 42, 회원 35)입니다. 느려지고
  입력 커서와 스크롤이 튑니다. 필요한 부분만 다시 그리세요.
- **`app/admin/app.js` 같은 큰 파일을 더 키우지 마세요.** 이미 31,000줄입니다.
  새 기능은 별도 파일로 만들고 `index.html`에서 불러오세요.

---

## 알려진 빚 (지금 상태를 오해하지 않도록)

- `app/tennis-note-legal/terms.html`이 없습니다. 가입 동의 화면이 이 파일을
  링크하고 있어 404입니다. 사업자 정보 확정 후 작성해야 하며,
  만들면 `check_cloudflare_build.py`의 `KNOWN_MISSING_PAGES`에서 지우세요.
- 개인정보처리방침이 두 벌입니다. 루트 `privacy.html`이 정식본,
  `app/tennis-note-legal/privacy.html`이 예전 초안인데 **앱은 초안을 링크합니다.**
- `app/shared/vendor/xlsx.full.min.js`가 없어서 엑셀 기능이 항상 외부
  CDN(jsdelivr)에 의존합니다.
- 색상 토큰(`:root`)이 세 스타일시트에 따로 있고 값이 서로 어긋나 있습니다.
- 파일이 너무 큽니다. `app/admin/app.js` 31,000줄, `bindEvents()` 하나가 2,385줄.
  화면 단위(관리자는 10개)로 쪼개는 게 다음 단계입니다.
