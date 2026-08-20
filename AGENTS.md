# AGENTS.md

Tennis Note 공개 저장소입니다. 회원앱·코치앱·관리자 세 개의 PWA 가 들어 있습니다.
**코딩 에이전트는 작업 시작 전에 이 문서를 끝까지 읽으세요.**

빌드 도구도 `package.json` 도 없습니다. 브라우저가 `.js` 파일을 그대로 읽습니다.

---

## 반드시 지킬 것 네 가지

### 1. 끝내기 전에 이걸 돌리세요

```bash
./scripts/verify.sh
```

**통과하지 않으면 끝난 것이 아닙니다.** CI 가 돌리는 것과 같습니다.
검사 268개가 여기서 돕니다. 무엇을 막는지는 [docs/verification.md](docs/verification.md).

### 2. 자동 검사만으로는 부족합니다. 브라우저로 보세요

이 저장소에서 지금까지 난 사고 **7건 중 6건이 브라우저에서만 드러났습니다.**
화면을 만지는 변경이면 반드시 띄워서 눌러보세요. 방법은
[docs/verification.md](docs/verification.md#브라우저로-확인) 에 있습니다.

### 3. 동작을 바꾸지 마세요 (정리 작업일 때)

지금 저장소는 **동작을 그대로 두고 구조만 정리하는** 단계를 지났습니다.
새 기능을 넣는 것은 괜찮지만, **정리와 수정을 같은 커밋에 섞지 마세요.**
섞이면 무엇이 깨뜨렸는지 알 수 없습니다.

버그를 발견했는데 지금 고칠 것이 아니라면 [docs/unfinished.md](docs/unfinished.md) 에 적으세요.

### 4. 검사기가 못 잡은 사고가 나면, 고치기 전에 검사기부터 고치세요

그래야 같은 사고가 두 번 안 납니다. 실제로 이렇게 검사를 여러 번 늘렸습니다.
[docs/incidents.md](docs/incidents.md) 에 사고와 그것을 막는 검사가 짝지어 있습니다.

---

## 무엇을 하려면 무엇을 읽어야 하나

| 하려는 일 | 읽을 것 |
|---|---|
| 코드가 어디 있는지 찾기 | [docs/structure.md](docs/structure.md) |
| 새 파일 추가 | [docs/structure.md](docs/structure.md#새-파일을-만들면-등록할-곳) |
| 큰 파일 쪼개기 | [docs/splitting.md](docs/splitting.md) |
| `origin/main` 병합 | [docs/merging.md](docs/merging.md) |
| 버전 올리기 · 배포 | [docs/releasing.md](docs/releasing.md) |
| 검사가 실패했을 때 | [docs/verification.md](docs/verification.md) |
| "왜 이 규칙이 있나" | [docs/incidents.md](docs/incidents.md) |
| 아직 안 된 것 확인 | [docs/unfinished.md](docs/unfinished.md) |

---

## 이 저장소에서만 통하는 것들

코드만 봐서는 알 수 없고, 어기면 **실사용자에게 사고가 납니다.**

### 버전은 손으로 올리지 마세요

버전이 11개 파일 273곳에 박혀 있습니다. 하나만 빠뜨리면 그 파일만 옛 캐시에
남아 사용자가 옛 화면을 봅니다.

```bash
./scripts/bump_release.py --next
```

자세한 것은 [docs/releasing.md](docs/releasing.md).

### 사용자 입력은 반드시 `escapeHtml` 을 거칩니다

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

**CSP 의 `script-src` 를 아직 조이지 못했으므로 이스케이프가 유일한 방어선입니다.**
구현은 `app/shared/tennisnote-escape-html.js` 한 곳에 있습니다.

### 서버는 이 저장소에 없습니다

브라우저가 `tn_users` 같은 테이블에 직접 접근합니다. **보안은 여기 코드가 아니라
Supabase RLS 정책이 책임집니다.** 스키마·RLS·엣지 함수는 `app-automation-vault`
저장소에 있습니다. **여기서 권한 검사를 추가해도 우회 가능합니다.**

### 비밀키

`app/shared/config.local.js` 는 배포 시 자동 생성되며 `.gitignore` 에 있습니다.
직접 만들어 커밋하지 마세요.

- 브라우저에 들어가도 되는 것: Supabase `publishable`(anon) 키, PortOne `storeId`, 채널 키
- **절대 안 되는 것**: Supabase `service_role` 키, PortOne API secret, 웹훅 secret

---

## 코드 규칙

- 들여쓰기 2칸, 큰따옴표, 세미콜론. **UI 문구와 주석은 한국어.**
- **전역 함수 이름은 겹치면 안 됩니다.** 같은 페이지의 스크립트끼리 이름이 겹치면
  뒤에 로드된 쪽이 조용히 덮어씁니다. `global-scope` 검사가 막습니다.
- `app/shared/` 의 파일은 IIFE 로 감싸고 `window.TennisNoteXxx` 로 내보냅니다.
  예외 둘은 [docs/structure.md](docs/structure.md#appshared-의-예외-둘) 참조.
- `localStorage` 키는 `tennis-note-` 접두사에 하이픈. 각 앱 `settings.js` 에 모여 있습니다.

## 커밋

**`Publish Tennis Note PWA 1.0.x` 같은 커밋을 만들지 마세요.** 이 저장소 커밋
546개 중 363개가 그 형태라 언제 뭐가 왜 깨졌는지 추적할 수 없습니다.

**변경 하나에 커밋 하나.** 제목은 무엇을, 본문은 왜.
버전 올리기는 별도 커밋.

## 하지 말 것

- React·Vue·Next.js·TypeScript 로 옮기지 마세요. 번들러나 `package.json` 도 넣지 마세요.
- `renderAll()` 을 새로 호출하는 코드를 늘리지 마세요. 관리자에만 57곳입니다.
  화면 전체를 다시 그려서 느려지고 입력 커서와 스크롤이 튑니다.
- `app.js` 를 다시 키우지 마세요. 지금 회원 429 · 코치 206 · 관리자 1,013줄입니다.
  새 기능은 [docs/structure.md](docs/structure.md) 의 폴더 규칙에 맞는 파일로.
