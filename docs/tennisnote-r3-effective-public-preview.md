# R3 적용일별 정산 공개 모듈 연결

범위는 기존 관리자 `회원·결제 > 월 정산 상세`와 코치 `내 정산`의 읽기 전용 미리보기다.
새 메뉴·역할·확정·지급·송금 동작은 추가하지 않는다. 자동 송금/환불은 이 변경의 기능이 아니다.

원본 feature `ddb549c413c5e820c974bdaed73b351d9afb6981`, PR #580 squash main
`6baedc13ebfaa13f8c68cea6a8bd95e1e4c65860`은 tree가 동일하다.
공개 dev 시작점은 `5f6ce6c45dbe31aed2555de39c8a550beaa3883a`이며 운영 전체 병합은 금지다.

`tests/fixtures/r3-effective-source-parity.json`은 원본 함수 10개, 허용 alias/누락 UI call 제거,
최종 public 함수 해시 및 exact inverse hunk를 고정한다. 금액 공식은 재구현하지 않았다.
공용 `tennisnote-settlement-adjustment.js`는 private Git blob 전체와 해시가 같다.
기존 golden은 변경하지 않고 후보 exact hash를 검증한 후 R3 hunk만 역변환한다.

호출 경로:

- admin views/billing → data/billing → `tn_coach_settlement_scope_v2` → 공용 exact projection
- coach 실제 index → data/sync → 동일 RPC → domain/settlement + views/settlement
- branch/coachRole/month, fingerprint, 금액 합계, ticket 연결이 틀리면 계산을 표시하지 않는다.
- v2 회원 연결은 exact user ID만 사용한다. 이름으로 다른 회원권에 fallback하지 않는다.
- 이전 요청의 늦은 응답은 현재 월/코치 조회를 덮어쓰지 않는다.
- 오류/HOLD는 확인 필요이며 금액 0원을 만들어 보여주지 않는다.
- owner gate OFF의 `confirmationReady=false`는 새 계산 미리보기/기존 확정 보존 안내를 유지한다.

공개에 없던 snapshot 확정/코치 이의 UI는 포팅하지 않았다.
`renderMonthlySettlementConfirmation`과 `renderCoachSettlementReconciliation`을 stub으로 가장하지 않았다.
기존 v1 DB 함수/구앱/기록을 변경하지 않으며 v2 확정 gate를 이 코드에서 켤 수 없다.
실제 signed PostgREST, 구앱 v1-v2 reader, 실제 역할 로그인, Android/iPhone, 운영 부하는 별도 게이트다.

| 기능 ID | 기준 | 이미지 | 구현 | 검사/화면 |
|---|---|---|---|---|
| SETTLE-01 | V6 정산·운동일지 사양, R3 야간 계획 | V3 59 | 기존 월 미리보기·내 정산 | 원장 전체 완료 아님; exact server amount만 |
| BRANCH-02 | 적용일·지점 role 분리 | V3 58 | data/billing·sync scope | exact scope mismatch FAIL |
| NFR-01/02/06/07 | 오류·권한·감사·서버 context | V3 66 | 공용 projection/error, stale guard | HOLD/오류/late response/권한 합성 검사 |

V3 atlas를 새 화면으로 재구현하지 않는다. 기존 월 선택·상세 접기·6열 표와 코치 bottom sheet를 재사용한다.
자동 브라우저는 실제 public index/module/CSS를 실행하되 합성 transport와 권한 UI 상태만 사용한다.
320~1366, 가로, light/dark, Chromium/WebKit 104 layout는 실제 로그인/실기기 PASS가 아니다.
외부 요청·hosted DB/Auth/write·금융 요청은 0이다.

빌드/배포는 이 문서 작성으로 실행되지 않는다. 개발 DB에 단일 R3 additive migration이 준비됐지만
운영 DB는 별도 적용/권한/호환 검증 전 이 PWA를 승격하면 안 된다.
롤백은 이전 public dev artifact로 복귀, owner gate OFF 유지다. additive DB down/delete는 하지 않는다.
