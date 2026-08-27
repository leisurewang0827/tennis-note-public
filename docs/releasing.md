# 버전 올리기

## 배포 브랜치 흐름

기능과 수정은 전부 `dev` 에서 완료하고 검증합니다. `main` 은 현재 운영에 배포된
코드만 두며 직접 커밋하거나 직접 푸시하지 않습니다.

1. `dev` 에서 실제 변경을 별도 커밋으로 완료합니다.
2. `./scripts/verify.sh` 와 관련 브라우저 화면을 확인합니다.
3. 운영자가 배포를 승인하면 아래 스크립트로 버전을 올려 별도 커밋합니다.
4. `dev` → `main` PR의 필수 검사가 통과한 뒤 병합합니다.
5. `main` 병합으로 시작된 Cloudflare Pages와 GitHub Pages 배포를 확인합니다.

끝나지 않은 변경이 `dev` 에 섞여 있을 때 긴급 수정이 필요하면 `main` 에서 별도
hotfix 브랜치를 만들고, 운영 반영 후 같은 수정을 `dev` 에도 되돌려 합칩니다.

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

## 버전 커밋은 따로 하세요

**실제 변경을 먼저 커밋하고, 버전 올리기는 그 다음 별도 커밋입니다.**

```bash
git commit -m "fix(member): ..."      # 실제 변경. 버전은 안 건드림
./scripts/bump_release.py --next
git commit -am "chore: 1.0.375"       # 버전만
```

버전 올리기는 **350곳 넘게** 건드립니다(파일을 나눌수록 늡니다. 지금 값은 `--dry-run` 으로). 한 커밋에 섞으면 실제 변경이 파묻혀
리뷰도 `git log -p` 도 무용지물이 됩니다. 되돌릴 때도 버전까지 같이 돌아갑니다.

운영 저장소는 배포할 때 한 번만 커밋해서 둘이 섞여 있습니다
(`Publish Tennis Note PWA 1.0.x`). **그 방식을 따라오지 마세요.**

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
