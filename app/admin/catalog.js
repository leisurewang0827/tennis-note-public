// 화면에 쓰는 고정 데이터 표.
//
// 전부 리터럴이다. 계산도 호출도 없다. 문구나 항목을 바꾸려면 여기만 고치면 된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 선언이라 쓰는 쪽은 예전과 같다.

const policyGuideTemplates = [
  {
    id: "makeup",
    title: "수업 변경",
    summary: "지점 기준시간에 따라 바로 변경 또는 코치 승인",
    copy: "회원 수업 변경의 기준시간·사유·승인 여부는 시간표의 운영 규칙에서 설정합니다. 승인 전에는 원래 수업을 유지하고, 거절돼도 이용권은 차감하지 않습니다.",
  },
  {
    id: "holding",
    title: "회원권 홀딩",
    summary: "개인 사유와 부상 사유를 분리해 관리",
    copy: "개인 사유 홀딩은 정해진 횟수와 기간 안에서 신청하며, 부상 홀딩은 진단서 등 증빙 확인 후 승인합니다. 승인된 기간만큼 회원권 만료일을 연장합니다.",
  },
  {
    id: "refund",
    title: "환불",
    summary: "실결제액과 사용 회차를 기준으로 관리자 확정",
    copy: "환불액은 실제 납부액에서 사용한 수업 금액과 관련 규정에 따른 공제액을 반영해 계산합니다. 최종 금액은 결제와 이용 기록을 대조한 뒤 관리자가 확정합니다.",
  },
];

const lessonPolicyDefaults = [
  {
    id: "lesson-change-before",
    title: "기준시간 이상 남은 변경",
    detail: "회원이 가능한 시간으로 바로 변경",
    category: "수업 변경",
    status: "active",
    systemKey: "change_before_24h",
  },
  {
    id: "lesson-change-within",
    title: "기준시간 미만 남은 변경",
    detail: "설정에 따라 코치 승인 또는 신청 불가",
    category: "수업 변경",
    status: "active",
    systemKey: "change_within_24h",
  },
  {
    id: "lesson-completion",
    title: "수업 완료 처리",
    detail: "코치 코멘트와 다음 커리큘럼 등록 후 차감",
    category: "수업 처리",
    status: "active",
    systemKey: "lesson_completion",
  },
  {
    id: "lesson-duration",
    title: "수업 단위",
    detail: "20분·30분, 40분·60분은 연속 회차 사용",
    category: "수업 단위",
    status: "active",
    systemKey: "lesson_duration",
  },
];

const operationMetrics = [
  { label: "예약", value: "2회", compare: "전일 1회", tone: "good" },
  { label: "방문자", value: "7명", compare: "전일 14명", tone: "warn" },
  { label: "신규 예약자", value: "6명", compare: "전월 0명", tone: "good" },
  { label: "재방문 예약자", value: "13명", compare: "전월 0명", tone: "good" },
  { label: "주간 누적 매출", value: "20,000원", compare: "지난 주 대비 91%", tone: "warn" },
  { label: "즐겨찾기", value: "149명", compare: "관심 회원", tone: "neutral" },
];

const reportMetrics = [
  { label: "활성 회원", value: "86명", detail: "회원 관리 기준", tone: "" },
  { label: "이번 달 수업", value: "312개", detail: "레슨 시간표 기준", tone: "calm" },
  { label: "출석 처리율", value: "91%", detail: "미처리 28건", tone: "warning" },
  { label: "코치별 정산", value: "4명", detail: "현금/카드 구분", tone: "accent" },
];

const benchmarks = [
  {
    name: "CourtReserve",
    role: "관리자 프로그램 기준",
    takeaway: "예약, 레슨, 멤버십, 결제, 모바일앱을 한 운영판에서 묶는다.",
  },
  {
    name: "Mindbody",
    role: "스케줄/결제 운영 기준",
    takeaway: "직원 관리, 결제, 리포트 흐름을 사업 관리 관점으로 정리한다.",
  },
  {
    name: "Club Automation",
    role: "대형 센터 운영 기준",
    takeaway: "회원권, 리포트, 마케팅, 결제 데이터를 한 곳에서 관리한다.",
  },
  {
    name: "예약형 앱",
    role: "국내 회원 앱 기준",
    takeaway: "예약 확인, 알림, 간단 결제처럼 회원이 자주 쓰는 흐름을 단순하게 둔다.",
  },
  {
    name: "스매시",
    role: "국내 모바일 UX 기준",
    takeaway: "날짜, 조건 필터와 강한 행동 버튼을 레슨/예약 화면에 적용한다.",
  },
];

const notificationPlan = [
  { title: "수업 하루 전", detail: "수업 시작 24시간 전 앱 푸시" },
  { title: "수업 30분 전", detail: "잠금화면 앱 푸시" },
  { title: "재등록 안내", detail: "잔여 2회와 만료 7일 전 안내" },
  { title: "만료 안내", detail: "회원권 만료일 오전 9시 안내" },
];

const serviceReadinessItems = [
  {
    title: "Supabase DB",
    status: "ready",
    label: "초안 완료",
    detail: "회원, 코치, 회원권, 레슨, 변경요청, 결제, 할인권, 알림 테이블 초안을 만들었습니다.",
    next: "RLS 권한과 실제 연결",
  },
  {
    title: "코치 권한",
    status: "setup",
    label: "관리자 부여형",
    detail: "관리자가 이름·휴대전화를 사전 등록하고, 확인된 번호로 로그인하면 코치 모드가 연결됩니다.",
    next: "회원 검색 후 코치 역할 부여",
  },
  {
    title: "결제",
    status: "pending",
    label: "서버 검증 전",
    detail: "회원앱 결제 UI는 있으나 PortOne 검증과 웹훅 연결 후 회원권 충전해야 합니다.",
    next: "Store ID, Channel Key, 검증 서버",
  },
  {
    title: "알림",
    status: "ready",
    label: "구조 완료",
    detail: "레슨 하루 전·30분 전과 잔여횟수·만료 알림을 DB 대기열과 앱 푸시로 연결했습니다.",
    next: "실기기 발송 검증",
  },
  {
    title: "기존 DB 이전",
    status: "draft",
    label: "마지막 전 단계",
    detail: "구글시트 레슨관리표와 고객 DB를 학습한 뒤 Supabase로 정리 이전합니다.",
    next: "가격 확정 전 데이터 매핑",
  },
];

const membershipProductStatusOptions = [
  { id: "sale", label: "판매중" },
  { id: "consult", label: "상담" },
  { id: "hidden", label: "숨김" },
];

const discountPolicyDefaults = [
  {
    id: "new-member-10",
    title: "신규 10% 할인권",
    type: "percent",
    value: 10,
    target: "정기권/쿠폰제",
    payment: "카드/현금",
    issueRule: "관리자 발급",
    coachPermission: "코치별 지급 수량 안에서 사용",
    coachQuota: 5,
    burden: "센터 부담",
    expiresDays: 30,
    status: "사용",
  },
  {
    id: "renewal-5",
    title: "재등록 5% 할인권",
    type: "percent",
    value: 5,
    target: "정기권",
    payment: "카드/현금",
    issueRule: "관리자 발급",
    coachPermission: "요청만 가능",
    coachQuota: 0,
    burden: "센터 부담",
    expiresDays: 14,
    status: "사용",
  },
  {
    id: "coach-referral",
    title: "코치 추천 할인권",
    type: "amount",
    value: 10000,
    target: "쿠폰제",
    payment: "현금 우선",
    issueRule: "관리자 승인",
    coachPermission: "코치가 요청하면 관리자 승인",
    coachQuota: 3,
    burden: "센터/코치 협의",
    expiresDays: 30,
    status: "검토",
  },
];

const refundPolicyRuleDefaults = [
  "회원 사유 환불은 실납부액에서 할인 전 원가의 10% 위약금을 차감",
  "사용한 수업은 할인 전 회당 금액으로 차감",
  "첫 수업이 속한 달에는 예약금 30,000원을 추가 차감",
  "분쟁이 생긴 경우에만 관리자가 소비자분쟁해결기준 검토 절차를 별도로 진행",
];

const policyVersionDefaults = [
  {
    id: "policy-2026-07-google-drive",
    title: "2026년 7월 기존 운영 기준",
    status: "active",
    effectiveFrom: "2026-07-01",
    source: "Google Drive DB 운영정책",
    summary: "구매 시점의 보강, 홀딩, 환불, 코치변경 규칙을 회원권에 스냅샷으로 저장합니다.",
    sections: [
      {
        id: "makeup",
        title: "보강/수업변경",
        rules: [
          "24시간 전 변경은 자동 승인",
          "24시간 이내 변경은 코치 승인 필요",
          "코치가 승인하지 않아도 당일 취소는 회원권 차감",
          "보강은 담당 코치의 기존 수업 시작 전후 40분 안에서만 신청 가능",
          "평일권은 평일, 주말권은 주말에만 신청 가능하며 관리자는 예외 처리 가능",
          "4주권 주1회는 주2회, 주2회는 주3회, 주3회는 주5회까지 보강 포함 사용",
          "3개월권은 보강 포함 15주 안에서 같은 날 최대 2회 사용",
        ],
      },
      {
        id: "holding",
        title: "홀딩/시간오픈",
        rules: [
          "4주 정규권 개인 사유 홀딩은 1회 최대 7일",
          "3개월 정규권 개인 사유 홀딩은 합계 최대 14일",
          "쿠폰제는 개인 사유 홀딩 없음",
          "부상·입원 홀딩은 증빙 확인 후 최대 30일, 추가 증빙으로 연장 검토",
          "부상 증빙 원본은 관리자만 확인하고 심사 후 보관기간에 맞춰 삭제",
          "원칙적으로 사전 신청하며 응급 사유는 3일 이내 소급 신청 가능",
          "재등록 알림 후 미결제 시 남은 2회 이후 주차부터 시간 오픈",
        ],
      },
      {
        id: "refund",
        title: "환불",
        rules: [...refundPolicyRuleDefaults],
      },
      {
        id: "transfer",
        title: "양도",
        rules: [
          "유료 회원권은 1회에 한해 잔여 전체만 양도 가능",
          "남은 기간과 평일·주말·수업시간·담당 코치 조건은 그대로 유지",
          "이벤트·무료 지급권은 양도 불가",
          "양수인 본인확인과 관리자 승인이 필요하며 재양도는 불가",
        ],
      },
      {
        id: "coach-change",
        title: "코치변경/대타",
        rules: [
          "회원권은 기본적으로 담당 코치 기준으로 사용",
          "코치 변경은 관리자 승인 후 새 코치 회원권 또는 이전 처리",
          "대타 수업은 실제 처리 코치가 기록/차감하고 정산 이관 기록을 남김",
        ],
      },
    ],
    ticketSnapshot: {
      policyVersionId: "policy-2026-07-google-drive",
      snapshotTiming: "payment_confirmed",
      fields: ["product", "price", "validity", "grace", "makeup", "refund", "holding", "coach_change"],
    },
  },
];

const notificationPolicyDefaults = {
  lessonDayBeforeEnabled: true,
  lesson30MinutesEnabled: true,
  couponNextBookingEnabled: true,
  ticketLowRemainingEnabled: true,
  lowRemainingThreshold: 2,
  ticketExpiryEnabled: true,
  expiryDaysBefore: 7,
  ticketExpiredEnabled: true,
  coachFeedbackReminderEnabled: true,
  coachFeedbackReminderMinutes: 30,
  coachFeedbackAdminEscalationEnabled: true,
  coachFeedbackAdminEscalationHours: 24,
  memberFeedbackReadyEnabled: true,
  scheduleRequestStaffEnabled: true,
  updatedAt: "",
};

const coachRegistrationFlow = [
  { step: "1", title: "코치 사전 등록", detail: "관리자가 이름과 휴대전화를 먼저 등록합니다." },
  { step: "2", title: "근무·정산 설정", detail: "요일, 가능 시간, 정산 방식과 적용일을 설정합니다." },
  { step: "3", title: "본인 로그인", detail: "코치가 같은 번호가 확인된 카카오·네이버 계정으로 로그인합니다." },
  { step: "4", title: "코치모드 연결", detail: "번호가 정확히 일치할 때만 통합앱에 코치모드가 열립니다." },
];

const supabaseLiveTables = [
  { id: "branches", table: "tn_branches", label: "지점", private: false },
  { id: "products", table: "tn_membership_products", label: "회원권 상품", private: false },
  { id: "coaches", table: "tn_coach_roles", label: "코치 권한", private: true },
  { id: "lessons", table: "tn_lessons", label: "수업 일정", private: true },
  { id: "tickets", table: "tn_member_tickets", label: "회원권 보유", private: true },
  { id: "payments", table: "tn_payments", label: "결제", private: true },
  { id: "discount-policies", table: "tn_discount_policies", label: "할인권 정책", private: true },
  { id: "discount-issues", table: "tn_discount_issues", label: "할인권 발급", private: true },
  { id: "discount-redemptions", table: "tn_discount_redemptions", label: "할인권 사용", private: true },
  { id: "policy-versions", table: "tn_policy_versions", label: "운영 정책 버전", private: true },
  { id: "ticket-policy-snapshots", table: "tn_ticket_policy_snapshots", label: "회원권 정책 스냅샷", private: true },
  { id: "notice-popups", table: "tn_notice_popups", label: "공지 팝업", private: true },
];

const supabaseLiveState = {
  loading: false,
  loaded: false,
  items: [],
  message: "아직 확인 전입니다.",
};

const authProviderState = {
  loading: false,
  loaded: false,
  items: [],
  message: "아직 확인 전입니다.",
};

const modeSummaries = {
  admin: {
    title: "관리자 운영판",
    subtitle: "전체 운영 흐름을 한눈에 보고 바로 처리합니다.",
    actions: ["회원 추가", "결제 등록", "시간표 조정", "리포트 확인"],
    metrics: ["오늘 수업 9개", "출석 대기 2건", "결제 대기 2건"],
  },
  coach: {
    title: "코치 전용 간단 화면",
    subtitle: "본인 수업, 출석 처리, 회원 메모만 빠르게 봅니다.",
    actions: ["내 수업 보기", "출석 처리", "회원 메모", "보강 요청 확인"],
    metrics: ["오늘 담당 2개", "확인 대기 1건", "메모 필요 1명"],
  },
  member: {
    title: "회원 앱 1차 화면",
    subtitle: "내 수업과 알림을 단순하게 확인하는 화면입니다.",
    actions: ["내 수업", "예약/변경 요청", "잔여 횟수", "알림"],
    metrics: ["다음 수업 6/30 07:00", "잔여 4회", "알림 1건"],
  },
};

const coachPreview = [
  { time: "06:40", title: "20분 슬롯", detail: "김서준 · 출석 대기" },
  { time: "07:00", title: "20분 슬롯", detail: "이하린 · 출석 대기" },
  { time: "08:00", title: "회원 메모", detail: "보강 일정 확인 필요" },
];

const memberAppPreview = [
  { label: "내 수업", value: "내일 07:00" },
  { label: "잔여 횟수", value: "4회" },
  { label: "변경 요청", value: "관리자 승인 대기" },
  { label: "알림", value: "수업 전 안내 예정" },
];

const settlements = [
  { date: "2026-06-22", sales: 53000, fee: 2073, net: 50927 },
  { date: "2026-06-15", sales: 187000, fee: 6686, net: 180314 },
  { date: "2026-06-09", sales: 41000, fee: 1374, net: 39626 },
];

const coachSettlementPreview = [
  {
    member: "김서준",
    product: "주2회 개인 20분",
    paymentMethod: "카드",
    paidAmount: 165000,
    settlementBase: 150000,
    coach: "노 코치",
    actualCoach: "노 코치",
    minutes: 20,
    lessonCount: 4,
    totalLessons: 10,
    discount: "신규 10%",
  },
  {
    member: "최유나&이하린",
    product: "주2회 2대1 20분",
    paymentMethod: "현금",
    paidAmount: 180000,
    settlementBase: 180000,
    coach: "강 코치",
    actualCoach: "강 코치",
    minutes: 20,
    lessonCount: 8,
    totalLessons: 8,
    discount: "코치 할인권",
  },
  {
    member: "박민재",
    product: "대타 30분",
    paymentMethod: "카드",
    paidAmount: 198000,
    settlementBase: 180000,
    coach: "노 코치",
    actualCoach: "황 코치",
    minutes: 30,
    lessonCount: 1,
    totalLessons: 1,
    discount: "대타 이관",
  },
];

const racketMembers = [
  { name: "예약회원 A", reservations: 6, total: 200000, lastVisit: "2026.06.19", action: "테니스노트 회원권 전환 검토" },
  { name: "예약회원 B", reservations: 3, total: 27000, lastVisit: "2026.05.21", action: "결제 이력 확인" },
  { name: "예약회원 C", reservations: 9, total: 76000, lastVisit: "2026.04.21", action: "재방문 지표 반영" },
];

const defaultMemberManagementPolicy = {
  coachCanCorrectTicket: false,
  coachCanExpireTicket: false,
  coachCanReenroll: false,
  requireAdminPin: true,
};

const coachStaffEditorState = {
  coachId: "",
  mode: "edit",
  tab: "basic",
  draft: null,
  workBlocks: [],
  breakBlocks: [],
  editingBlockType: "",
  editingBlockId: "",
  message: "",
};

const coachLaneOrderEditorState = {
  roleIds: [],
  baselineRoleIds: [],
  revision: "",
  confirmed: false,
  loading: false,
  saving: false,
  message: "",
};

const adminMenuDefinitions = [
  { id: "dashboard", label: "대시보드", required: true },
  { id: "members", label: "회원·결제" },
  { id: "schedule", label: "레슨시간표" },
  { id: "reports", label: "경영 리포트" },
  { id: "notes", label: "기록/차감 확인" },
  { id: "issues", label: "개선·오류 접수" },
  { id: "settings", label: "운영 설정", required: true },
];

const adminDefaultMenuOrder = ["dashboard", "schedule", "members", "reports", "notes", "issues", "settings"];

const adminDefaultMoreMenus = ["reports", "notes", "issues", "settings"];

const adminLayoutPresets = {
  owner: {
    label: "대표",
    detail: "경영 리포트와 회원·결제를 주 메뉴에서 바로 확인합니다.",
    menuOrder: ["dashboard", "reports", "schedule", "members", "notes", "issues", "settings"],
    moreMenus: ["notes", "issues", "settings"],
  },
  operations: {
    label: "운영",
    detail: "시간표·회원·결제를 먼저 두고 나머지는 더보기에 모읍니다.",
    menuOrder: [...adminDefaultMenuOrder],
    moreMenus: [...adminDefaultMoreMenus],
  },
  simple: {
    label: "간단 보기",
    detail: "대시보드·시간표·회원만 남겨 처음 쓰는 직원도 쉽게 찾습니다.",
    menuOrder: [...adminDefaultMenuOrder],
    moreMenus: ["reports", "notes", "issues", "settings"],
  },
};

const adminDashboardGroupDefinitions = [
  { id: "metrics", label: "핵심 운영 수치" },
  { id: "operations", label: "오늘 처리·회원·코치", required: true },
  { id: "lessons", label: "오늘 레슨" },
  { id: "insights", label: "공지·운영 요약" },
];

const adminDashboardWidgetDefinitions = {
  operations: [
    { id: "tasks", label: "오늘 처리할 일", required: true },
    { id: "members", label: "회원 현황" },
    { id: "coaches", label: "코치 업무" },
  ],
  insights: [
    { id: "notices", label: "공지·알림" },
    { id: "reports", label: "운영 요약" },
  ],
};

const adminReportWidgetDefinitions = [
  { id: "summary", label: "경영 핵심 수치", required: true, defaultSize: "full" },
  { id: "members", label: "회원 흐름", defaultSize: "two" },
  { id: "quality", label: "피드백·출석", defaultSize: "two" },
  { id: "finance", label: "재무 자료 상태", required: true, defaultSize: "full" },
  { id: "sources", label: "리포트 개발 순서", defaultSize: "full" },
];

const adminReportWidgetSizeOptions = [
  { id: "one", label: "1칸" },
  { id: "two", label: "2칸" },
  { id: "full", label: "전체" },
];

const adminReportWidgetFilterOptions = [
  { id: "all", label: "전체" },
  { id: "attention", label: "확인 필요만" },
];

const defaultAdminLockSettings = {
  enabled: false,
  pinHash: "",
  legacyPin: "",
  pinConfigured: false,
  timeoutMinutes: 30,
  lockedViews: [],
  pastAbsenceRequirePinEveryTime: false,
};

const adminLockSession = {
  unlockedUntil: 0,
  pendingView: "",
  pendingAction: "",
  pendingLabel: "",
  oneTimeGrant: "",
  error: "",
  afterUnlock: null,
};

const adminLockViewOptions = [
  { id: "schedule", label: "레슨시간표", detail: "수업 추가, 변경, 삭제, 상태 보정" },
  { id: "billing", label: "결제/정산", detail: "결제 확인, 수동 충전, 코치 정산" },
  { id: "data", label: "엑셀·백업", detail: "엑셀 업로드, 전체 내보내기, 백업" },
  { id: "settings", label: "운영 설정", detail: "수업 정책, 회원권 규정, 관리자 보안" },
  { id: "notes", label: "기록/차감 확인", detail: "수업 완료, 횟수 차감, 코치 코멘트" },
  { id: "members", label: "회원관리", detail: "회원 상세, 회원권 상태, NTRP" },
  { id: "issues", label: "개선·오류 접수", detail: "접수 상태 변경과 운영 오류 기록" },
];

const adminSecurityPresets = {
  transition: {
    label: "과도기 운영",
    detail: "로그인은 유지하고 추가 PIN 없이 운영합니다.",
    enabled: false,
    timeoutMinutes: 30,
    lockedViews: [],
    pastAbsenceRequirePinEveryTime: false,
  },
  protected: {
    label: "중요 메뉴 보호",
    detail: "결제·데이터·운영 설정만 PIN으로 보호합니다.",
    enabled: true,
    timeoutMinutes: 15,
    lockedViews: ["billing", "data", "settings"],
    pastAbsenceRequirePinEveryTime: true,
  },
};

const defaultPopupNotice = {
  id: "notice-new",
  title: "새 공지",
  body: "공지 내용을 입력해 주세요.",
  audience: "all",
  status: "disabled",
  priority: "normal",
  startDate: "",
  endDate: "",
  showOncePerDay: true,
  displayOrder: 10,
  imageUrl: "",
  imageStoragePath: "",
  imageAlt: "",
  actionLabel: "",
  actionUrl: "",
  updatedAt: "",
  updatedBy: "admin",
};

const importTemplateColumns = [
  "구분",
  "회원명",
  "연락처",
  "동반회원명",
  "동반연락처",
  "상태",
  "담당코치",
  "회원권명",
  "수업분",
  "주횟수",
  "총횟수",
  "사용횟수",
  "잔여횟수",
  "결제일",
  "결제수단",
  "결제금액",
  "정규요일1",
  "정규시간1",
  "정규요일2",
  "정규시간2",
  "메모",
];

const importVisibleMemberColumns = [
  "회원명",
  "연락처",
  "출생연도",
  "거주동",
  "성별",
  "회원상태",
  "담당코치",
  "회원권명",
  "레슨시작일",
  "총횟수",
  "소진횟수",
  "결제일",
  "결제수단",
  "결제금액",
  "파트너연락처",
  "비고",
];

const importAutomaticMemberColumns = [
  "원본번호",
  "지점명",
  "적용방식",
  "레슨방식",
  "레슨종류",
  "파트너원본번호",
  "만료일",
  "잔여횟수",
  "결제상태",
];

const importMemberColumns = [...importVisibleMemberColumns, ...importAutomaticMemberColumns];

const importScheduleColumns = [
  "시간표원본번호",
  "회원원본번호",
  "수업일",
  "시작시간",
  "수업분",
  "상태",
  "메모",
];

const requiredImportMemberColumns = [
  "원본번호",
  "회원명",
  "연락처",
  "출생연도",
  "성별",
  "회원상태",
  "담당코치",
];

const requiredActiveImportMemberColumns = [
  "회원권명",
  "레슨방식",
  "레슨종류",
  "레슨시작일",
  "총횟수",
  "소진횟수",
  "잔여횟수",
];

const bankNotificationStatusState = {
  status: "idle",
  devices: [],
  reviewEvents: [],
  accountHistory: [],
  message: "",
};

const discountCoachPermissionToServer = {
  "코치별 지급 수량 안에서 사용": "coach_quota",
  "요청만 가능": "request_only",
  "관리자만 사용": "admin_only",
};

const discountCoachPermissionFromServer = {
  coach_quota: "코치별 지급 수량 안에서 사용",
  request_only: "요청만 가능",
  admin_only: "관리자만 사용",
};

const adminToolConfig = {
  data: { title: "엑셀 가져오기·내보내기", lockView: "data" },
  coach: { title: "코치·직원 관리", lockView: "settings" },
  schedule: { title: "시간표 설정", lockView: "settings" },
  notice: { title: "공지·알림 관리", lockView: "settings" },
  products: { title: "회원권·할인 설정", lockView: "billing" },
};

const memberManagementDayLabels = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

const authProviderChoices = [
  { value: "custom:naver", label: "네이버" },
  { value: "custom:kakao", label: "카카오" },
  { value: "apple", label: "Apple" },
  { value: "email", label: "이메일" },
];

const memberFilterCopy = {
  active: { summary: "명 수강중", empty: "수강중인 회원이 없습니다." },
  expiring: { summary: "명 만료임박", empty: "잔여 2회 이하 회원이 없습니다." },
  pending: { summary: "명 가입서·결제대기", empty: "가입서·결제 대기 회원이 없습니다." },
  journal: { summary: "명 앱가입", empty: "로그인만 완료한 앱가입 회원이 없습니다." },
  app_link: { summary: "명 앱 연결 필요", empty: "분리된 앱 계정이 없습니다." },
  expired: { summary: "명 만료", empty: "만료된 회원이 없습니다." },
  deletion: { summary: "건 탈퇴요청", empty: "접수된 탈퇴요청이 없습니다." },
  inactive: { summary: "명 삭제", empty: "삭제 처리된 회원이 없습니다." },
};

const memberInlineDraftFieldNames = [
  "memberName",
  "memberPhone",
  "memberBirthYear",
  "memberNeighborhood",
  "memberGender",
  "productId",
  "scheduleScope",
  "coachRoleId",
  "partnerUserId",
  "startsOn",
  "expiresOn",
  "totalSessions",
  "usedSessions",
  "paymentRecordState",
  "paymentDate",
  "paymentMethod",
  "paymentAmount",
  "note",
  "applyToFutureSchedule",
  "scheduleDay1",
  "scheduleDay2",
  "scheduleDay3",
  "scheduleTime1",
  "scheduleTime2",
  "scheduleTime3",
];

const importServerIssueLabels = {
  no_rows: "가져올 행이 없습니다.",
  no_member_rows: "회원DB에 가져올 회원이 없습니다.",
  required_value_missing: "필수값이 비어 있습니다.",
  numeric_value_invalid: "숫자로 입력해야 하는 값이 맞지 않습니다.",
  ticket_balance_mismatch: "총횟수, 사용횟수, 잔여횟수가 맞지 않습니다.",
  time_format_review: "수업 시간 형식 확인이 필요합니다.",
  unknown_coach_name: "등록된 코치명과 맞는지 확인이 필요합니다.",
  possible_duplicate_ticket_row: "같은 회원/코치/회원권 조합이 중복될 수 있습니다.",
  group_partner_required: "2대1 회원권은 동반 회원 이름과 연락처가 필요합니다.",
  group_partner_same_phone: "대표 회원과 동반 회원의 연락처가 같습니다.",
  source_number_duplicate: "원본번호가 중복됐습니다.",
  source_number_missing: "원본번호가 없습니다.",
  source_member_not_found: "시간표의 회원원본번호를 회원DB에서 찾을 수 없습니다.",
  product_not_found: "판매중 회원권 상품과 정확히 일치하지 않습니다.",
  target_branch_required: "현재 운영 지점을 먼저 선택해야 합니다.",
  branch_mismatch: "현재 운영 지점에 속한 코치와 회원권만 사용할 수 있습니다.",
  schedule_status_invalid: "새 시간표의 상태는 예정만 사용할 수 있습니다.",
  schedule_slot_duplicate: "같은 회원의 같은 날짜·시간 수업이 중복됐습니다.",
  schedule_preserved: "시간표 입력이 없어 기존 서버 시간표를 보존합니다.",
  schedule_group_manual_review: "1:2 시간표는 두 회원의 회원권 연결을 확인해야 합니다.",
  review_sheet_not_empty: "검토대기 시트의 행을 정리해야 합니다.",
  payment_review_sheet_not_empty: "결제검토 시트의 행을 정리해야 합니다.",
  import_month_invalid: "작성안내의 이관월을 YYYY-MM 형식으로 입력해야 합니다.",
  workbook_branch_name_required: "작성안내의 지점명을 입력해야 합니다.",
  workbook_branch_mismatch: "작성안내의 지점과 현재 운영 지점이 다릅니다.",
};

const importServerFieldLabels = {
  memberName: "회원명",
  phone: "연락처",
  partnerName: "동반회원명",
  partnerPhone: "동반연락처",
  coachName: "담당코치",
  ticketName: "회원권명",
  totalSessions: "총횟수",
  usedSessions: "사용횟수",
  remainingSessions: "잔여횟수",
  paymentAmount: "결제금액",
  targetBranchId: "운영 지점",
  scheduleSourceNumber: "시간표원본번호",
  memberSourceNumber: "회원원본번호",
  lessonDate: "수업일",
  startTime: "시작시간",
  durationMinutes: "수업분",
  status: "상태",
  regularTime1: "정규시간1",
  regularTime2: "정규시간2",
};
