# R4 수납·정산 원본 통합 / 일반 지점장 로컬 후보

2026-11-22. 운영·개발 원격 설치 승인이 없는 로컬 후보다.

## 기준과 범위

- BRANCH-02/03, COACH 정산 설정 → 9/9 CRM 작업지시 W4, 9/2 R4 개정 → V3 이미지58의 기존 운영 설정·수동 등록 영역.
- 새 메뉴·디자인·회원권/정산 계산법은 만들지 않는다. 기존 `r4BranchHoursPanel`에 배포 검증 모듈 두 개를 연결한다.
- `r4-branch-finance-paid.js`는 검증된 원본과 바이트 동일하다. 정산 모듈은 코치 명단 RPC 이름 한 곳만 금융 전용 조회로 바꾼다. 기존 코치 관리·연결 RPC는 수정하지 않는다.
- PG 결제·공개 판매·환불·송금·알림·Auth·역할·운영 스위치는 변경하지 않는다.

## 설치 계약

`baseline-settlement.sql`, `baseline-paid.sql`, `baseline-history.sql`은 과거 검증 원본의 보존본이다. 새로운 서버 규칙은 `owner-candidate.sql` 하나에 분리한다. baseline-paid는 기존 구매 증거 reader를 변경하는 과거 설치 계약을 포함하므로 임의로 운영에 실행하면 안 된다.

새 SQL은 여섯 함수의 전체 정의 지문이 예상 baseline과 맞는 경우에만 설치한다. OID·소유자·ACL·설정은 설치 당시 값을 백업하고 교체 후 보존 여부를 검사하며, 사전 고정된 메타데이터 allowlist 검사는 아니다. 적용 직전에 승인된 카탈로그와 전체 ACL·OID·소유자·설정을 별도로 대조한다. 이미 운영에 있는 canary 보호 본문은 허용 baseline이 아니므로 거부한다. 운영 보호를 제거하거나 옛 함수를 덮어써 설치를 통과시키지 않는다. 개발/운영 승격 전에 실제 정의와의 별도 대조·승인된 적용/복구본이 필요하다.

설치 후 제어 행은 0개다. 일반 지점장은 추가 전역 관리자 역할 없이 다음 조건을 모두 만족해야 한다.

1. 정상 인증된 활성 일반 회원이며 auth ID가 서버 회원 프로필과 일치.
2. 해당 지점의 서버 소유관계와 활성 manager 역할이 모두 존재.
3. 지점 상태가 active/inactive이고 그 지점의 수납/정산/이력 capability가 명시적으로 켜짐.
4. 상품·대기 회원·담당 코치가 모두 본인 지점이며 기존 수납·회원권 조건을 만족.

특정 QA 계정·상품 allowlist 및 시간제 lease 대신 지점 소유권과 capability를 사용한다. 비공개 유료 개인권·수납 기록만 지원하며, 임의 할인·0원권·그룹권·연장·공개 판매로 확대하지 않는다. 수납 기록은 이미 받은 돈의 기록이지 PG 결제가 아니다.

## OFF와 원복

- `owner-off.sql`: 세션 설정 `tennisnote.r4_finance_target_branch`로 지점 UUID 하나를 명시해야 한다. 그 지점의 세 capability만 OFF하고 기록은 보존한다.
- 개방된 거래와 OFF는 같은 제어 행 잠금을 사용한다. 이미 허용된 거래는 OFF 완료 전에 커밋될 수 있지만, OFF가 완료된 뒤에는 늦은 저장·재시도·조회가 허용되지 않는다. 먼저 커밋된 권한 회수도 대기 중 요청을 차단한다. 이미 커밋된 기록을 취소하거나 삭제하는 계약은 아니다.
- `owner-rollback.sql`: 신규 capability와 과거 임시 lease가 모두 OFF여야 한다. 설치 지문·메타데이터가 그대로일 때만 여섯 원래 함수를 정확히 복구하고 추가 코치 조회 실행 권한을 회수한다. 구매·수납·회원권·기준·감사·backup/control 행은 삭제하지 않는다.

## 이번 새 검증

- `scripts/check_tennisnote_r4_finance_owner_delta.mjs`: PGlite에서 DEV/PROD 소유 테이블 모양 각각에 대해 일반 지점장·타 지점 차단, 중복, 저장 중 회수·롤백, OFF·기록 보존, 정확 원복·오염/다른 본문 거부 검사. 기존 금융 engine의 purchase evidence 부분은 명시적 fixture stub이다. 전체 실제 구매 원장/정산 엔진 재검증이 아니다.
- `scripts/check_tennisnote_r4_finance_owner_concurrency.mjs`: 새 로컬 PostgreSQL 17의 별도 실제 연결들로 OFF 선후, manager/owner 회수, 동시 정산·수납 중복을 검사. 로컬 pg driver 경로는 `R4_PG_DRIVER`, 서버 바이너리는 `R4_PG_BIN` 또는 설치된 로컬 runtime을 사용한다. 두 실행에서 만든 합성 DB는 종료·삭제했다. 두 번째 `--paid-only`는 첫 다섯 통과 분기를 반복하지 않는다.
- `scripts/check_tennisnote_r4_finance_owner_browser.mjs`: 기존 HTML section과 원본 JS를 사용하는 격리 브라우저의 통합 검사. 원격 요청/쓰기 0. 최초 코치 roster transport 대역은 후속 금융 전용 endpoint 검사로 대체했다.
- `scripts/check_tennisnote_r4_finance_owner_coaches.mjs`: 최종 RPC 이름 한 곳 변경, 실제 로컬 SQL 명단/기준 조회, 해제·퇴사·보관 코치 제외와 원복 후 실행 거부 검사.

첫 검사 실패는 새 operation key에 대한 거부 코드의 테스트 기대 차이였다. 기존 writer가 이미 활성화한 회원은 `r4_paid_member_denied`(42501)로 차단하므로 이를 중복 차단으로 인정하도록 검사만 수정했다. 금융 writer의 기존 중복 조건은 변경하지 않았다. 먼저 통과한 DEV scope 다섯 묶음은 재실행하지 않고 인수했다.

## 완료와 미완료

로컬 소스 통합·새 권한/경합/원복 검사까지 완료했다. 원격 DB 실제 Auth/RLS, 개발계 로그인·저장, 운영 설치·개방·배포, CI·독립 담당 검수, 앱 빌드·스토어는 이번에 하지 않았다. 과거 20분 수업/차감/코치 +15,000원 검증은 재사용하며 다시 실행하지 않았다. 이 로컬 후보를 R4 전체 또는 운영 실사용 완료로 표시하지 않는다.
