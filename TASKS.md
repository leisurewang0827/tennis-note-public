# TASKS.md — 남은 작업 목록

이 저장소에서 앞으로 해야 할 일입니다. 상시 규칙은 `AGENTS.md`에 있습니다.
**작업 시작 전에 `AGENTS.md`를 먼저 읽으세요.** 여기서는 반복하지 않습니다.

## 이 문서를 쓰는 방법

- **한 번에 작업 하나만 하세요.** 여러 개를 묶지 마세요.
- 각 작업의 **완료 기준**은 명령으로 확인할 수 있게 적혀 있습니다. 그걸 실제로
  돌려서 통과하는지 확인한 뒤에 끝났다고 하세요.
- 작업을 끝내면 **이 파일에서 그 항목을 지우고** 같은 커밋에 포함하세요.
  지우지 않으면 다음 세션이 같은 일을 또 합니다.
- **순서 제약이 있습니다.** 5번은 3번보다 먼저 하지 마세요. 이유는 5번에 적었습니다.
- 작업 중 새 문제를 발견하면 고치지 말고 **이 파일 맨 아래 "발견한 것"에 적으세요.**
  범위를 넓히면 되돌리기 어려워집니다.

## 이미 끝난 것 (다시 하지 마세요)

`stabilize/phase-0` 브랜치에서 처리했습니다. 자세한 내용은 `git log`를 보세요.

- 사용자 입력 13곳 `escapeHtml` 처리 (관리자·코치 화면 저장형 XSS)
- 커리큘럼 카탈로그 `?v=` 불일치 (관리자만 옛 파일 캐시)
- 캐시 헤더 `no-store` → `no-cache`, 보안 헤더 추가
- CI에 링크 검사(`a`/`img` 포함)와 버전 일치 검사 추가
- 관리자 아티팩트의 법적 페이지 "앱으로 돌아가기" 404 → `_redirects` 처리
- localhost에서 서비스워커 등록 건너뛰기
- `AGENTS.md` 작성

---

# 1. 서비스 이용약관 페이지 만들기

**급함. 법적 문제입니다.**

가입 동의 화면이 `../tennis-note-legal/terms.html`을 링크하는데 그 파일이 없습니다.
커밋 460개를 확인했고 한 번도 존재한 적이 없습니다. 지금 가입하는 모든 회원이
열어볼 수 없는 문서에 **필수 동의**를 하고 있습니다.

- **링크 위치**: `app/tennis-note-member-app/index.html:792`
- **만들 파일**: `app/tennis-note-legal/terms.html`

**하는 일**

1. `app/tennis-note-legal/privacy.html`의 HTML 구조·클래스·헤더/푸터를 그대로
   따라 만드세요. 새 스타일을 만들지 마세요.
2. 본문 내용은 **사람이 확정해야 합니다.** 사업자등록번호, 대표자명,
   통신판매업신고번호가 저장소 어디에도 없습니다. 임의로 지어내지 마세요.
   비어 있는 항목은 눈에 띄게 표시하고 넘기세요.
3. 기존 문서에 이미 있는 사실만 근거로 쓰세요:
   - 운영 주체·연락처·주소 → `commerce.html`의 "5. 운영자와 고객지원"
   - 환불·해지 기준 → `commerce.html`의 "4. 취소와 중도 해지"
   - 개인정보 처리 → `privacy.html` (루트에 있는 정식본)
4. `scripts/check_cloudflare_build.py`의 `KNOWN_MISSING_PAGES`에서
   `/tennis-note-legal/terms.html` 줄을 지우세요.

**완료 기준**

```bash
python3 scripts/build_cloudflare_pages.py --target member --output dist/member
python3 scripts/check_cloudflare_build.py   # 통과해야 함
```

`KNOWN_MISSING_PAGES`가 비었는데도 통과하면 링크가 실제로 연결된 것입니다.

**하지 말 것**: 법률 문구를 창작하지 마세요. 사업자 정보를 추측해 채우지 마세요.

---

# 2. 개인정보처리방침 한 벌로 통합

문서가 두 벌이고 **앱은 옛 초안을 보여줍니다.**

| 파일 | 상태 |
|---|---|
| `privacy.html` (루트) | 시행일 2026-07-18 **정식본**. 처리자·연락처·주소 있음 |
| `app/tennis-note-legal/privacy.html` | 시행일 2026-07-17 **초안**. "베타 테스트용 초안" 안내문이 남아 있고, 8번 항목에 처리자와 연락처가 없음 |

앱의 가입 동의 화면은 아래쪽(초안)을 링크합니다.

**주의: 단순 복사가 아닙니다.** 초안에만 있는 문장이 두 개 있고, 둘 다 내용상
필요해 보입니다. 정식본에 합쳐야 할지 사람에게 확인하세요.

- 공동 레슨에서 다른 회원에게 제공된 수업 결과의 보관 관련 문단
- 제3자 제공 항목의 Supabase·PortOne 명시

수집 항목 설명도 서로 반대로 적혀 있습니다(출생연도·성별·거주 동네를 가입 시
받는지 첫 구매 시 받는지). 어느 쪽이 실제 동작인지는 **코드로 확인하세요** —
`app/tennis-note-member-app/index.html`의 `identitySetupForm` 입력 항목이 근거입니다.

**하는 일**

1. 정식본을 기준으로 두 문서를 하나로 합칩니다.
2. `app/tennis-note-legal/privacy.html`은 남기되 내용은 정식본과 같게 하고,
   "앱으로 돌아가기" 링크 같은 경로 차이만 유지합니다.
3. `support.html`과 `index.html`도 같은 방식으로 두 벌입니다. 같이 정리하세요.

**완료 기준**

```bash
# 초안 표시가 남아 있으면 안 된다 → 0
grep -c "초안" app/tennis-note-legal/privacy.html

# 개인정보 처리자와 연락처가 들어 있어야 한다 → 각각 1 이상
grep -c "개인정보 처리자" app/tennis-note-legal/privacy.html
grep -c "0507-1325-9052" app/tennis-note-legal/privacy.html

# 시행일이 두 문서에서 같아야 한다 → 출력이 같아야 함
grep -o "시행일:[^<]*" privacy.html app/tennis-note-legal/privacy.html
```

두 문서를 눈으로도 한 번 비교하세요. 링크 문구(`서비스 홈` / `앱으로 돌아가기`)와
경로만 다르고 본문은 같아야 합니다.

```bash
diff privacy.html app/tennis-note-legal/privacy.html
```

---

# 3. 버전 올리기 자동화 (`scripts/bump_release.py`)

앱 버전이 9개 파일 **73곳**에 손으로 박혀 있습니다. 배포할 때마다 사람이 10개
파일을 고치고 있고, 하나라도 빠뜨리면 그 파일만 옛 캐시에 남습니다.
(실제로 관리자만 옛 커리큘럼을 보던 사고가 있었습니다.)

CI가 불일치를 잡아주게는 했지만, 애초에 틀릴 일이 없게 만드는 게 낫습니다.

**하는 일**

`scripts/bump_release.py` 를 만듭니다. `app/release.json`을 유일한 기준으로 삼아
아래를 전부 갱신합니다.

- `app/release.json` 의 `version`, `appSurfaceVersion`, `releaseId`, `deployedAt`
- `app/shared/tennisnote-release.js` 의 같은 필드
- `app/**/*.html` 과 `app/**/service-worker.js` 의 `?v=<semver>`
  (외부 URL과 `/vendor/` 경로는 건드리지 않습니다 — `check_cloudflare_build.py`의
  `verify_version_consistency` 가 같은 규칙을 씁니다. 규칙을 두 벌로 만들지 마세요.)
- 두 서비스워커의 `CACHE_NAME` 숫자 (`...-v405`, `...-v379`)

사용법은 `python3 scripts/bump_release.py 1.0.360` 형태로.

**완료 기준**

```bash
python3 scripts/bump_release.py 1.0.360
python3 scripts/check_cloudflare_build.py   # 통과
git diff --stat                              # 9개 파일이 바뀌어야 함
git checkout .                               # 되돌리기
```

**하지 말 것**: 버전 규칙을 새로 만들지 마세요. `check_cloudflare_build.py`가
검사하는 규칙과 정확히 같아야 합니다.

---

# 4. 관리자 앱을 화면 단위 파일로 쪼개기

`app/admin/app.js` 가 **31,096줄**입니다. 이 파일이 커진 게 지금 가장 큰 문제입니다.

다행히 구조는 좋습니다. 함수 1,209개 중 100줄 넘는 건 33개뿐이라, **쪼개는 일은
기계적입니다. 로직을 다시 설계할 필요가 없습니다.**

경계선은 이미 정해져 있습니다. `app/admin/index.html`에 화면이 정확히 10개 있습니다.

```
dashboardView  scheduleView  membersView  billingView  makeupView
notesView      reportsView   issuesView   dataView     settingsView
```

**하는 일 (한 번에 화면 하나씩)**

1. `<script type="module">` 로 바꿉니다.
2. **작은 화면부터** 시작하세요. 함수 이름으로 대략 재보면 이렇습니다
   (정확한 값은 아니고 순서를 정하는 용도입니다).

   | 화면 | 관련 함수 | 대략 줄 수 |
   |---|---|---|
   | `issuesView` | 7 | 87 |
   | `notesView` | 6 | 164 |
   | `makeupView` | 16 | 251 |
   | `reportsView` | 11 | 269 |
   | `dashboardView` | 7 | 272 |
   | `dataView` | 43 | 1,227 |
   | `billingView` | 98 | 2,161 |
   | `settingsView` | 167 | 4,711 |
   | `membersView` | 241 | 6,207 |
   | `scheduleView` | 391 | 8,109 |

   `issuesView` 로 시작해 방법을 익히고, 위에서부터 내려가세요.
   `scheduleView` 와 `membersView` 는 마지막에 하세요.
3. 그 화면의 `render*` 함수와 전용 헬퍼를 `app/admin/views/<이름>.js` 로 옮깁니다.
4. 그 화면의 이벤트 등록을 2,385줄짜리 `bindEvents()`(`app/admin/app.js:28259`)에서
   떼어내 같은 파일로 옮깁니다.
5. 로컬에서 그 화면을 실제로 눌러 확인합니다.
6. 커밋합니다. **그다음 화면으로 넘어갑니다.**

**절대 두 화면을 한 번에 옮기지 마세요.** 되돌릴 수 없게 됩니다.

**완료 기준 (화면 하나당)**

```bash
node --check app/admin/app.js
node --check app/admin/views/<이름>.js
python3 scripts/build_cloudflare_pages.py --target admin --output dist/admin
python3 scripts/check_cloudflare_build.py
```

그리고 `http://localhost:8000/app/admin/?demoAdmin=1` 에서 해당 화면이
쪼개기 전과 똑같이 동작해야 합니다.

**목표**: 3,000줄 넘는 파일이 없을 것.

---

# 5. 회원 앱과 코치 앱의 중복 제거

**4번을 끝낸 뒤에 하세요.** 파일을 쪼개고 나면 무엇이 공용인지 눈에 보입니다.
지금 하면 뭘 옮겨야 할지 판단하기 어렵습니다.

두 앱에 이름까지 같은 함수가 **32개**, 10줄 단위로 완전히 같은 블록이 **211개**입니다.
한쪽에서 버그를 고쳐도 다른 쪽은 그대로 깨져 있습니다.

중복 함수 예: `escapeHtml`, `saveSnapshot`, `restoreSnapshot`, `loadSharedData`,
`saveSharedData`, `showToast`, `localDateKey`, `minutesFromTime`, `lessonDuration`,
`registerPwaServiceWorker`, `setView`, `jumpToTop`, `shortCoachName`

**하는 일**

1. 두 앱의 함수 이름 목록을 뽑아 겹치는 것을 확인합니다.
2. **본문이 실제로 같은지 반드시 비교하세요.** 이름만 같고 동작이 다르면
   옮기면 안 됩니다.
3. 같은 것만 `app/shared/` 로 옮깁니다. 새 파일은 IIFE로 감싸고
   `window.TennisNoteXxx` 로 내보냅니다 (`AGENTS.md` 참조).
4. 두 `index.html` 과 두 `service-worker.js` 의 `APP_SHELL` 에 새 파일을 추가합니다.
   **넷 다 고쳐야 합니다.**

**완료 기준**: 회원앱과 코치앱을 둘 다 로컬에서 열어 주요 화면이 정상 동작.
`check_cloudflare_build.py` 통과.

---

# 6. 색상 토큰 통합

세 스타일시트가 각자 `:root` 를 선언하고 값이 어긋나 있습니다.

| 토큰 | 관리자 | 회원·코치 |
|---|---|---|
| `--ink` | `#172033` | `#182230` |
| `--line` | `#d9e0e8` | `#d0d5dd` |
| `--amber` | `#b7791f` | `#b54708` |
| `--wash` | `#f4f7fb` | `#eef4f1` / `#edf3f1` (셋 다 다름) |

같은 의도의 색이 화면마다 다르게 나옵니다.

이름만 보면 `app/shared/tennisnote-ui-foundation.css` 가 공용 토큰 파일 같지만,
**변수를 하나도 정의하지 않고 색을 하드코딩한 컴포넌트 CSS입니다.** 확인하고 시작하세요.

`admin/styles.css` 는 `:root` 를 두 번(1행, 13847행), 회원·코치도 두 번씩
선언합니다. 나중 선언이 앞을 덮어씁니다. 합칠 때 어느 값이 실제로 적용 중인지
브라우저에서 확인하세요.

**완료 기준**: 토큰이 공용 파일 한 곳에만 있고, 세 앱의 주요 화면이 시각적으로
전과 같을 것. 급하지 않습니다. 4번·5번 뒤에 하세요.

---

# 7. 서버 저장소를 볼 수 있게 하기

**코드 작업이 아니라 사람이 결정할 일입니다.** 에이전트는 이 항목을 실행하지 마세요.

브라우저가 `tn_users`, `tn_journal_entries`, `tn_holding_requests` 같은 테이블에
직접 접근합니다. **보안은 전적으로 Supabase RLS 정책이 책임집니다.**
그런데 스키마·RLS·엣지 함수 8개가 `app-automation-vault` 에 있어서, 이 저장소만
봐서는 "회원 A가 회원 B의 기록을 읽을 수 있나"를 판단할 수 없습니다.

읽기 전용 사본이라도 확보하는 것을 권합니다.

---

# 발견한 것 (아직 작업으로 만들지 않음)

작업 중 발견한 것을 여기 적으세요. 바로 고치지 마세요.

- `app/shared/vendor/xlsx.full.min.js` 가 없습니다. `app/admin/app.js:22084` 가
  로컬 사본을 먼저 찾고 실패하면 jsdelivr CDN으로 넘어갑니다. 동작은 하지만
  엑셀 기능이 항상 외부 CDN에 의존합니다. 라이브러리(약 900KB)를 저장소에 넣을지는
  사람이 정할 일입니다.
- 루트의 `_headers` 파일은 GitHub Pages에서 무시됩니다. 실제로 적용되는 것은
  `scripts/build_cloudflare_pages.py` 가 생성하는 쪽입니다. 혼동하지 마세요.
- `localStorage` 키가 35개인데 정리된 목록이 없습니다.
  `tennis-note-admin-layout-v1` 과 `tennisnote_admin_layout_v1` 처럼 규칙이
  어긋난 것이 섞여 있습니다.
- `renderAll()` 이 클릭 한 번에 화면 전체를 다시 그립니다. 호출 지점이 123곳
  (관리자 46, 코치 42, 회원 35). 목록이 길어지면 느려지고 입력 커서와 스크롤이
  튑니다. 4번을 하면서 부분 렌더로 바꿀 기회가 생깁니다.
- `script-src` 를 아직 조이지 못했습니다. 인라인 `<script>` 4개와 인라인 이벤트
  핸들러 3개(`onerror` 2, `onclick` 1)를 걷어내면 CSP로 XSS를 한 겹 더 막을 수
  있습니다. 지금은 `escapeHtml` 이 유일한 방어선입니다.
