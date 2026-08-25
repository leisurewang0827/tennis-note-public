# `origin/main` 병합

저쪽(운영 저장소)은 하루 3~4번 배포합니다. **미루지 말고 자주 하세요.**
며칠 몰아두면 한 번에 어려워집니다.

## 왜 그냥 `git merge` 로 안 되나

우리는 `app.js` 를 수십 개 파일로 쪼갰습니다. 저쪽이 고친 함수가 우리 쪽에서는
**다른 파일에 삽니다.** 충돌 마커만 보고 풀면 오판합니다.

## 1. 먼저 보세요 (아무것도 바꾸지 않습니다)

```bash
git fetch origin
./scripts/merge_report.py
```

**"저쪽이 고친 함수 → 우리 쪽 현재 위치"** 표가 나옵니다.

```
■ app/tennis-note-member-app/app.js
   저쪽 변경: 수정 4 · 신규 0 · 삭제 0
   ── 수정된 함수와 우리 쪽 현재 위치 ──
     hideBrandSplash    → app/tennis-note-member-app/ui/sheet.js (저쪽 본문으로 교체 후 바이트 대조)
     initApp              app.js 그대로 (충돌 풀면 됨)
```

우리 쪽에 없는 함수는 **유실**이므로 별표로 표시합니다.

## 2. 안전점을 만드세요

```bash
git branch backup/pre-merge-<버전>
```

## 3. app.js 는 "저쪽 것에서 우리가 옮긴 것만 빼기" 로 풉니다

```bash
git merge origin/main --no-commit
./scripts/merge_resolve.py app/admin app/tennis-note-member-app app/tennis-note-coach-app
```

충돌 블록을 손으로 고르지 마세요. **저쪽 `app.js` 를 통째로 가져와서, 우리가
다른 파일로 옮긴 함수·상수를 다시 빼냅니다.** 그러면 저쪽 변경을 하나도 안 놓칩니다.

스크립트가 `⚠ 손으로 확인` 으로 짚어주는 것은 **우리도 고쳐둔 함수**입니다.
저쪽 본문을 받고 우리 수정을 다시 얹으세요. 대개 서로 다른 줄이라 겹치지 않습니다.

⚠ **저쪽 본문과 우리 본문이 다르다고 바로 바꾸면 안 됩니다.**
우리 쪽에는 [기본값 이음매](splitting.md#기본값-이음매는-쓰지-마세요) 가 61개
남아 있어서, 그렇게 하면 그 작업이 통째로 되돌아갑니다.

**기준점(`git merge-base`)과 저쪽을 비교해서, 저쪽이 실제로 고친 것만** 손대세요.
우리 본문이 기준점과도 다르면 (= 우리가 고쳐둔 것) **자동으로 바꾸지 말고 보고만**
하고 사람이 판단하게 하세요.

실제로 이걸 빠뜨려 이음매를 통째로 되돌리고 공용 파일까지 덮어쓴 적이 있습니다.
`git merge --abort` 로는 스크립트가 직접 고친 파일이 안 돌아옵니다.
**`git checkout -- .` 까지 해야 합니다.**

## 4. 옮겨둔 함수는 저쪽 본문으로 교체하고 바이트 대조합니다

`merge_report.py` 가 짚어준 위치에서 본문을 저쪽 것으로 바꿉니다.

## 5. `bindEvents` 는 따로 다룹니다

```bash
./scripts/merge_bindevents.py restore <병합전-브랜치> app/admin …   # 우리 호출 목록 복원
./scripts/merge_bindevents.py place   app/admin …                  # 어디에 넣을지 보여만 줌
./scripts/merge_bindevents.py apply   app/admin …                  # 실제로 넣음
./scripts/merge_bindevents.py diff    app/admin …                  # 집합 비교로 확인
```

우리가 `events/` 로 쪼개서 통째 대조가 안 됩니다. 저쪽이 넣은 덩어리를 **문맥으로
찾아 제자리에** 넣습니다. 앞 문맥이 유일하지 않으면 폭을 넓혀가며 찾습니다.

확인은 **"우리 `events/` 전체를 이으면 저쪽 `bindEvents` 본문과 같은 줄들인가"**
로 합니다. 순서는 다릅니다(우리는 `delegated` 를 앞으로 뺐습니다). 그래서
**줄 단위 diff 가 아니라 집합으로** 비교하세요.

## 6. `index.html` 과 서비스워커

**우리 스크립트 목록을 유지**하고 저쪽 신규 스크립트만 더합니다.
버전과 캐시 이름(`CACHE_NAME`)은 저쪽 것을 씁니다.

**`app.js` 로 되돌리지 마세요.** 중복 선언이 되고 나중 로드가 이겨 저쪽 수정이
조용히 무시됩니다 (`global-scope` 가 잡습니다).

## 7. 끝나고 확인할 것

- **저쪽 함수 유실 0 · 중복 0** — 저쪽 `app.js` 의 모든 함수가 우리 어딘가에 있는지
- `./scripts/verify.sh`
- **브라우저** — 저쪽 신규 기능이 우리 새 위치에서 동작하는지

## 비용 예측

머지 비용은 **저쪽이 "우리가 옮긴 함수" 를 몇 개 건드리느냐**에 비례합니다.
1.0.371 → 1.0.373 병합은 8개였고 충돌 8곳이었습니다.
