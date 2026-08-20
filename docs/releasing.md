# 버전 올리기

버전이 **여러 파일 수백 곳**에 박혀 있습니다. 파일을 나눌수록 늘어납니다.
하나라도 빠뜨리면 **그 파일만 옛 캐시에 남아 사용자가 옛 화면을 봅니다.**

지금 몇 곳인지는 `./scripts/bump_release.py --next --dry-run` 이 알려줍니다.

## 손으로 하지 마세요

```bash
./scripts/bump_release.py --next            # 끝자리 +1
./scripts/bump_release.py 1.0.380           # 버전 지정
./scripts/bump_release.py --next --dry-run  # 무엇이 바뀔지만 확인
```

바꾸는 곳: `release.json` · `tennisnote-release.js` · 각 `index.html`·`app.js` 의
`?v=` · 서비스워커 두 개의 `CACHE_NAME` 카운터.

## 건드리지 않는 곳

네이티브 배포 때 따로 움직입니다. 이력에서도 늘 별도 커밋이었습니다.

- `release.json` 의 `nativePlatforms.*` (`preparedVersion`, `latestBuild` 등)
- `tennisnote-release.js` 의 `nativeShell.*` (`androidVersion` 등)

`?v=notion-catalog-3` 처럼 **세머버가 아닌 캐시 키는 대상이 아닙니다.**
그 파일만 따로 무효화하려는 것이므로 손대지 마세요.

## 스크립트가 스스로 검사합니다

끝나고 **옛 버전이 남았는지 확인하고, 남으면 아무것도 쓰지 않고 멈춥니다.**
모르는 자리가 새로 생기면 파일과 줄 번호를 짚어줍니다. 그때 스크립트에 추가하세요.

`tests/bump-release.test.js` 가 `--dry-run` 을 돌려 이 상태를 지킵니다.
버전 자리가 새로 생겨 스크립트가 모르면 **테스트가 먼저 실패합니다.**

## 실제로 이런 일이 있었습니다

`app.js` 를 쪼개면서 `URLSearchParams({ v: "1.0.371" })` 이 `ui/screens.js` 로
옮겨갔습니다. 스크립트와 배포본 검사가 **`app.js` 경로를 하드코딩**하고 있어서
둘 다 놓쳤습니다. 지금은 `app/` 아래 `.js` 전체를 봅니다(vendor 제외).

**파일 위치에 기대는 검사를 만들지 마세요.** 파일을 옮기면 조용히 비켜갑니다.

## 서비스워커 캐시 이름

`CACHE_NAME` 은 버전 문자열과 별개의 카운터입니다(`tennis-note-member-pwa-v421`).
**이름이 그대로면 브라우저가 옛 캐시를 계속 씁니다.**

파일만 봐서는 "올렸는지" 판단할 수 없어서 검사기가 막지 못합니다.
**bump 스크립트가 항상 +1 하므로, 스크립트를 쓰는 것이 유일한 안전한 경로입니다.**
