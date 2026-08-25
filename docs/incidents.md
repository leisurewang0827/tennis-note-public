# 사고 기록

**규칙만 적어두면 왜 그런지 잃어버립니다.** 여기에 사고와 그것을 막는 것을
짝지어 둡니다. 이 표를 보고 "이 규칙은 이제 없애도 되나" 를 판단할 수 있습니다.

## 실사용자에게 영향이 갔던 것

| 사고 | 원인 | 지금 막는 것 |
|---|---|---|
| 회원 이름이 관리자 화면에서 코드로 실행됨 | `innerHTML` 에 입력값을 그대로 넣음 | `escapeHtml` (검사기 없음 — **문서와 습관에만 의존**) |
| 관리자만 옛 커리큘럼 카탈로그를 봄 | 버전 `?v=` 를 한 곳 빠뜨림 | `check_cloudflare_build.py` 버전 일치 검사 |
| 가입 동의 화면의 약관 링크 404 | 없는 페이지를 링크 | `check_cloudflare_build.py` 링크 검사 (`<a>` 까지 봄) |

## 구조 정리 중에 낸 것 — 브라우저에서만 드러난 것들

**자동 검사는 전부 사후에 따라붙었습니다.**

| 사고 | 원인 | 뒤늦게 추가한 검사 |
|---|---|---|
| `allScheduleSettings is not defined` | 이음매 치환이 함수 밖으로 샘 | `seam-scope` · `script-load` |
| `allCoaches.find is not a function` | 이음매 함수를 `flatMap` 콜백으로 넘김 | `seam-callback` |
| 중복 이음매 5곳 | 시그니처 기본값을 본문 참조로 오인 | `undefined-identifiers` |

정리 중에 `minutesFromTime is not defined` 도 브라우저에서 봤지만, 그건 **정리와
무관한 기존 버그**였습니다. 별도 커밋으로 고쳤습니다.

이 사고들 때문에 **기본값 이음매 방식을 중단**했습니다.
[docs/splitting.md](splitting.md#기본값-이음매는-쓰지-마세요) 참조.

## 검사기가 먼저 잡은 것 — 브라우저까지 가지 않았음

검사기를 늘린 효과가 실제로 나타난 사례들입니다.

| 잡은 검사 | 무엇을 |
|---|---|
| `bump-release` | 버전 리터럴이 `ui/screens.js` 로 옮겨가 스크립트가 놓친 것 |
| `script-load` | `window` 를 읽어 남긴 상수를, 그것을 참조하는 상수만 옮겨 TDZ 로 터진 것 |
| `script-load` | `settings.js` 가 `catalog.js` 값을 전개(`...`)로 쓰는데 먼저 실린 것 |
| `admin-values` | `escapeHtml` 을 옮겼는데 함수 목록에서 안 지운 것 |
| `event-binding` | `bindEvents` 가 `app.js` 밖으로 나간 것 |
| `global-scope` | 공용 파일을 관리자에 실으면 `$`·`$$` 가 `const` 선언과 충돌하는 것 |
| `global-scope` | 병합 중에 `renderCoachSettlementPreview` 가 두 번 선언된 것 |
| `layer-boundaries` | `domain/` 에서 서버를 부르던 함수 6개 (판정만 하는 곳이 아니었다) |

## 검사기가 못 잡아서 시간을 잡아먹은 것

⚠ 여기 실렸다가 검사기가 생겨 위로 올라간 것도 있습니다. 1.0.405 병합에서
충돌 9곳 중 8곳만 풀어 **충돌 마커가 커밋까지 갔는데**, `verify.sh` 를
`| grep` 뒤에서 돌려 실패 종료 코드가 가려졌습니다. 지금은 `verify.sh` 가
마커를 직접 검사하고, **verify 는 파이프에 넣지 말고 종료 코드를 보세요.**


**검사기로 못 만든 것들입니다.** 문서에 적는 것 외에 방법을 못 찾았습니다.

| 겪은 일 | 왜 검사기로 안 되나 | 어디에 적었나 |
|---|---|---|
| 관리자에 `defer` 를 붙여 `app.js` 보다 나중에 실행 | 로드 순서 문제는 `script-load` 가 순서를 그대로 재현하지 않으면 안 잡힘 | [structure.md](structure.md#앱마다-스크립트-싣는-방식이-다릅니다) |
| 브라우저가 캐시한 옛 파일을 써서 "함수가 없다" | 로컬 브라우저 상태는 저장소가 알 수 없음 | [verification.md](verification.md#함수가-없다고-나오면-캐시부터-의심하세요) |
| `merge --abort` 로 스크립트가 고친 파일이 안 돌아옴 | git 이 관리하는 상태가 아님 | [merging.md](merging.md) |
| 정규식 정적 분석 오분류 (누적 8회) | 정규식으로 JS 를 파싱하는 것 자체가 한계 | [splitting.md](splitting.md#검출기를-믿지-마세요) |
| 문서 규모 표를 갱신하다 행 모양이 같은 "폴더 뜻" 표까지 덮어씀 (사흘간 방치) | 문서 내용 검사가 없었음 → `docs-links` 에 불변식 추가, 갱신은 `update_structure_sizes.py` 로만 | [structure.md](structure.md) |

## 아직 검사기가 없는 위험

- **`escapeHtml` 누락** — 새 코드가 입력값을 감싸지 않아도 아무것도 막지 않습니다.
  `innerHTML` 에 들어가는 템플릿에서 `${...}` 가 `escapeHtml` 을 거치는지 보는
  검사를 만들 수 있을 것 같은데, 오탐이 많아 아직 안 만들었습니다.
- **`ui/`·`forms/` 의 서버 호출** — `domain/`·`views/` 만 `layer-boundaries` 가
  막습니다. 관리자 `ui/billing.js` 등 6곳이 서버를 부르는데, 저쪽이 만든 환불
  흐름이라 옮기려면 손이 큽니다. **분류가 틀렸던 게 아니라 나중에 어긋난
  것입니다** — 나눌 때는 정말 여닫기만 했는데 저쪽이 서버 호출을 넣었습니다.
- **서비스워커 `CACHE_NAME` 미증가** — 파일만 봐서는 "올렸는지" 판단할 수 없습니다.
  [releasing.md](releasing.md#서비스워커-캐시-이름) 참조.
