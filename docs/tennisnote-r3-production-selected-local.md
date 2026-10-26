# R3 운영 선별 후보 — 로컬 조립 계약

## 최신 상태 스냅샷 — 2026-10-26 보완 커밋 직전

- PR217은 OPEN이며 이 스냅샷의 head는 ba33470300ab0ea2525ebdd97e3f54607e762b78다. 첫 Public CI40283359452는 문서 안내/과거 경로 수집기 등록2건으로 실패했고, 승인된5파일의 로컬 보완·집중6건은 통과했다. 아직 보완 커밋의 새 CI 결과는 아니다. 이후 정확한 head/check 상태는 PR 이력과 최종 HANDOFF로 확인한다.
- fetch1 후 운영 main8face01719c79d075b513df71cf9793f24088c49 객체가 로컬에 있으며 기존 BASIC556 tree와 같다. 같은 checkout의 운영558 branch는 이 main을 부모로 하므로 최종33경로를 검토한다. 이전 보존 branch/로그인/기존 증거는 유지했다.
- 실제 운영 READ ONLY 조회1회에서 선행7이력과 canonical 부모0331해시를 확인했다.230은 없고, compatible_clients_verified=false / snapshot writes_enabled=false / manual gate는 미생성(null)이다. null을 관측된 OFF로 부르지 않는다. 서버 관측 TLS1.3이며 direct PostgreSQL verify-full 증거와 구분한다. 조회를 다시 실행하지 않았다.
- 병합·DBapply·스위치 전환·배포·native/store는0이다. 새 source CI가 통과하기 전 운영 GO가 아니며, 기존 승인 경계가 자동 확대되지 않는다.

아래 초기19/31파일·객체 부재·UNKNOWN·원격0 기록은 각각 최초 로컬 조립/메타데이터 검수 시점의 역사 증거다. 삭제하거나 현재 상태로 덮어쓰지 않았으며, 현재 판정은 이 스냅샷과 후속 실제 PR/HANDOFF가 우선한다.

현재는 로컬 후보이며 운영 GO·게시·실기기 완료가 아니다. 새 정책·메뉴·계산식을 만들지 않는다.

## 소스 경계

- 운영 배포 기록의 main `8face01719c79d075b513df71cf9793f24088c49` 객체는 로컬에 없다. fetch하지 않았다.
- 보존된 BASIC556 `8aada4bc43e275c2474c71a535c7e94eca4f26b5`의 실제 tree `d65e6a981b351c72405d4d7794e23f0d0238f0cb`가 운영 반환 기록과 같다. fresh remote ancestry 확인과 구분한다.
- 검증된 public DEV `31ad00f0c2494c089ba91030a9673047e94063d4`의 정산 부분만 재사용한다. 최신18파일만 가져오는 것도 선행 관리자 확정 코드를 놓치므로 허용하지 않는다.
- private `9e4d41e4007cbd74835a9e1eb7b4d3348888898e`와 같은 tree의 로컬 소스에서 admin blob `b2e7ed287bf7e7b7822bfaa93868ccc4382095a6`, coach blob `f26f248d66a6c7c172053ff381b0cdf9823fea08`를 확인했다. 기존 DEV 포트의 원본 권위와 일치한다.
- 기존 legacy exporter는 modular 저장소를 덮어쓰지 못하도록 차단한다. 이를 우회하거나 private 전체 앱을 복사하지 않는다. 기존 검증 포트의 정확한 정산 함수와 명시적 HTML 이동만 선별한다.
- 제품11파일은 `tests/fixtures/r3-production-selected-source.json`으로 고정한다. commit SHA는 아직 없으며 base+제품 aggregate/file SHA로 식별한다. BASIC의 fresh once readback, 기존 인증·결제·수입·커리큘럼·일지는 보존한다.

## 기능·목업 추적

| 기능 | 기준 계획/작업지시 | 기준 이미지 | 구현/검사 |
|---|---|---|---|
| SETTLE-01 | V6_SETTLEMENT_JOURNAL_SPEC, V6_RELEASE_SLICES R3, 10/7 실행계획 | V3 58, 59는 기능 atlas만 | 기존 관리자 월 정산 상세: 계산본/확정/수동 기록·정정; 정확 scope·원천·revision·operation key·readback |
| COACH-02, SETTLE-01 | V6 기존 내 정산 재사용 | V3 56 | 기존 내 정산 sheet: 확인/이의, 사유·개인정보 검증, 응답 유실 readback, 자기 범위만 |
| BRANCH-02, NFR-01/02/06/07 | V6 GO/NO-GO 및 현재 승인 경계 | V3 58, 66 | PIN·역할·세션/지점/월 변경·OFF·오류·중복·stale 응답 차단 |
| NFR-04 | V3 렌더 명세 | V3 56/58/66 | 새 조합의 집중 Chromium/WebKit 390/768/1366/landscape, light/dark; 실제 기기와 별도 |

목업은 직접 확인했다. 플랫폼 화면59를 정산 전용 새 메뉴로 만들지 않는다. 기존 화면의 접힌 상세와 코치 sheet를 재사용한다. 자동 화면은 실제 HTML/CSS와 선별 모듈에 합성 transport를 연결한 검사이며 전체 앱 부팅·실로그인·설치 앱 증거가 아니다.

### 이번 집중 화면 증거의 한계

- 첫 실행은 Chromium 관리자8조합을 끝낸 뒤 코치의 월 선택 합성 상태 불일치로 멈췄다. 월 입력 DOM만 바꾸고 실제 session 선택을 바꾸지 않았던 검사 준비 오류이며 제품을 강제 표시하거나 getter/guard를 바꾸지 않았다.
- 실제 `selectCoachSettlementMonth`로 준비한 뒤 남은24조합/549단언을 통과했다. 이전8조합을 반복하지 않았다. 첫8조합은4개 PNG와 실행 순서 증거만 있고 초기 개별 ledger가 없으므로 새24조합의 상세 결과와 구분한다.
- 768px 사진4개는 별도 capture-only로 추가했다. 검사 단언0/RPC0이며 새로운 테스트 PASS로 세지 않는다.
- light/dark는 OS colorScheme 환경 검사다. 기존 화면이 light palette를 유지하므로 별도 dark palette 구현·출시 PASS로 보고하지 않는다. 코치 상단 예상0은 합성 기본값이며 확정14,400원과의 실제 hosted 일치 증거가 아니다.
- 390/768/1366 사진은 기존 상세/sheet 구조 비교다. 스크롤 안쪽 하단은 정적 PNG 한 장만으로 전체 노출/실기기 조작을 증명하지 않는다. Android/iPhone은 이번 단계 NOT VERIFIED다.

## 검사 연결

- 새 선별층을 BASIC+고정 DEV의 기계적 recipe로 재구성한 뒤만 BASIC556 bytes로 정확히 역변환한다.
- JS `r3-basic-refresh-production` 및 Python `before_basic_refresh_candidate → before_r3_candidate` 실제 소비자에 먼저 연결한다. 기존 BASIC/553 기대값과 역사 fixture는 바꾸지 않는다.
- 기존23 collector는 새 owned 경로의 정확 합집합을 검사한 뒤 원래23으로 되돌린다. 누락·중복·unknown·one-byte drift는 실패한다.
- commit 여부에 따라 scope가 0으로 변하지 않도록 `git diff <고정base> -- app`와 untracked 명세를 함께 사용한다.
- 후속 공식558 메타데이터13층은 별도 `r3-production-selected-release.json` 계약으로 재구성한다. 실제 JS/Python 소비자는 metadata13 → selected11 → BASIC556 → 기존553 순서로 정확히 역변환한다. 제품 전용 fixture와 역사 기대값은 그대로다. 현재 app 변경22경로와 전체 checkpoint31경로를 정확히 검사하며 누락·중복·unknown은 실패한다.
- 이번 단위에서는 전체 verify/Core/Browser/DB177/native를 반복하지 않는다. 새 조합 집중검사만 실행한다. 보호 checker2는 읽기·해시·import·실행·복사·수정하지 않는다.

## DB 의존과 스위치 — 실제 운영값은 아직 UNKNOWN

- 새 SQL/RPC/migration을 작성하지 않는다. 기존 snapshot/confirmation/reconciliation, effective calculator와 write guard 계약을 재사용한다.
- `20261023001000` canonical manual-record migration은 운영 실제 존재/정확 부모가 확인되지 않았으므로 **조건부 pending**이다. 없을 때만 정확 기존 소스·부모 검증과 별도 운영 승인 후 적용 후보가 된다. 이 문서는 적용 증거가 아니다.
- `20260906001000/02000/03000`, `20261006003000`, `20261007001000` 등 기존 선행 계약의 실제 운영 상태/함수·권한 parity는 운영 전 읽기 전용 검토 대상으로 남긴다. 모르는 상태를 임의 적용 목록으로 만들지 않는다.
- DEV custody `20261025001000`과 fixture 도구는 운영 대상에서 제외한다.
- `compatible_clients_verified`, snapshot `writes_enabled`, manual-payout `writes_enabled`의 운영 값은 UNKNOWN이다. local/DEV PASS로 ON을 추정하거나 일반 관리자 토글을 추가하지 않는다.
- effective gate OFF는 기존 v1 쓰기 전체를 차단한다는 뜻이 아니다. 새 v2 생성, legacy v1, 기존 확정 reader의 계약을 구분한다. manual gate OFF에서는 기록/정정 UI가 잠기며 서버도 거부한다. snapshot write 거부는 preview READY 후 실제 create 거부까지 합성 검사한다.
- 환불 재분배·자동 송금·자동 지급은 HOLD/범위 밖이다. 수동 지급 기록은 실제 은행 송금·환불이 아니다.

## 릴리스·native·복구

- 첫 제품 검수 당시 BASIC556인19파일 증거는 outputs에 보존했다. DEV557과 구분하여 공식 `bump_release.py 1.0.558 --release-id 2026.10.26.02 --dry-run`을 검토한 뒤 같은 명령의 apply를1회 실행했다. 현재 로컬 후보는558 / 2026.10.26.02 / member591 / coach564이며13파일374치환이다. 캐시는 운영 origin의590/563보다 증가했다. private/native metadata·nativeShell·preparedBuild·서명·스토어는 그대로다. 원격·게시0이다.
- pre-release 제품11 중 HTML2개만 공식 query metadata와 겹친다. metadata13을 제거하면 기존 제품 aggregate `0da38232af994bdc44eb06237a49380b14b5bf400362d5d973cdb8b843436661`이 그대로다. 기능·정책 본문 변경은 없다. 최종31 = 기존19 + metadata-only11 + release fixture1이다.
- metadata 영향7검사 PASS: 새3건(공식13재구성/소스기능hash/네이티브보존, 실제 JS·Python 전체연결,12종 계약변조 및 one-byte·경로 실패)과 변경된 연결4건만 실행했다. 이전23건의 비즈니스 행동·화면24/549·prior8·DEV DB 증거는 재사용하며 전체 반복하지 않는다. 별도 기존 exact23 collector 연결1건도 PASS다.
- 소스 검토에서 제품 HTML2개의 기존 오류 discriminator를 그대로 보존했다. 강화한 새 negative case의 첫 재검사에서 anchored regex가 Error 전체 문자열과 message 본문을 혼동해 실패했다. 반환 오류는 정확했고 차단은 정상이다. message 필드에 정확히 비교하도록 수정 후 그 영향1건만 PASS했다. 기존 기대값/허용 범위는 완화하지 않았다.
- 예상 후속 public PR은 Tennis Note Public PWA CI, 운영 병합 후 Public CI + Deploy Tennis Note short URLs + Deploy Tennis Note web beta다. 이번에는 새 CI·원격 조회/게시를 실행하지 않는다.
- native는 private 전체 앱이 아니라 동일 승인 public candidate를 기존 `production-web-source.json`의 commit/tree/content/manifest pin으로 고정해야 한다. 후보 commit이 없으므로 아직 pin/IPA/AAB를 만들거나 완료로 부르지 않는다.
- 운영 전 실제 main ancestry/tree, DB 의존/권한, 각 쓰기 스위치의 별도 승인 범위를 한 번에 확인해야 한다. 실제 사용자 정산 확정·지급·금융·Auth 작업은 포함하지 않는다.
- 복구는 승인된 owner 경로로 새 v2/수동 쓰기를 먼저 중단하고 호환 reader를 유지한다. 검증된 이전 public artifact/BASIC556 tree를 단조 증가한 새 release/cache로 복구한다. 기존 v2 확정 이력이 있으면 읽을 수 있는 reader를 버리지 않는다. additive DB down/drop·과거 이력 삭제·재라벨 금지.
- DEV의 실제 14,400원 저장/확인/기록·역분개/설정 복원/close/OFF/최종25검사 PASS는 재사용 증거다. 선별 운영 후보의 운영·기기 PASS로 승계하지 않는다.

## 첫 원격 CI 등록 누락 보완

- 첫 후보 ba334703의 Public CI40283359452는 Node509 중503 PASS/2 FAIL/4 SKIP으로 종료됐다. 새 문서의 AGENTS 안내와 과거553 실제 changedAppPaths 수집기 연결을 놓친 구현·검수 누락이다. 제품·DB·Linux 장애로 분류하지 않는다. 실패 run 재실행은 하지 않는다.
- AGENTS는 고정 BASIC source 본문에 이 문서의 안내 행1개만 추가했다. 실제 전체 bytes 비교와 누락/중복/본문 변경 음성검사로 운영·보안 지침이 그대로임을 증명한다.
- 과거 수집기는 고정553 raw 경로 합집합과 선별22 실제 변경 경로를 먼저 정확히 확인한다. 모든 과거35파일은 원래 candidate/base SHA와 비교하고, 새 successor 경로는 metadata/selected/BASIC 역변환 후 과거 base와 bytes가 같을 때만 당시 변경 없음으로 판정한다. filename 단순 filter나 과거35/23/golden 변경은 없다. 고정 운영 base의 다른 checkout 우회도 거부하며 별도 합성 Git의 기존 일반 수집 계약은 보존한다.
- 수정은 AGENTS, 기존 promotion helper, selected helper, selected test, 이 문서의5파일뿐이다. 최종 PR 범위는 기존31+AGENTS+promotion helper=33이다. app22/제품0da/release558/cache/native/runtime은 그대로이며 버전을 다시 올리지 않는다.
- 집중검사는 기존 실패2와 새 실제 진입점·unknown/누락/중복/byte·AGENTS 본문 음성3건만 통과했다.33경로에 맞춘 기존 metadata 음성1건도 변경 영향으로 확인한다. 나머지503 성공·운영 조회1·DBCI/full Core/Browser/native는 반복하지 않는다.
- 로컬 증거를 MAIN이 독립 검수한 뒤에만 같은 PR217의 보완commit1/nonforcepush1/새 source Public CI1로 진행한다. 병합·DBapply·스위치·배포·native/store는 계속 제외한다.
