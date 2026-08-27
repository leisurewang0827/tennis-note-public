// 저장소 키·버전 문자열·크기 같은 작은 상수.
//
// localStorage 키가 흩어져 있으면 무엇이 쓰이는지 알 수 없어 한곳에 모았다.
// 키는 tennis-note- 로 시작하고 하이픈을 쓴다.
// app.js 에서 본문 그대로 옮겨왔고 전역 선언이라 쓰는 쪽은 예전과 같다.

const adminBrandSplashMinimumDuration = 250;

const scheduleSafetySnapshotKey = "tennis-note-admin-schedule-safety-v1";

const adminSnapshotVersion = 2;

const scheduleSafetySnapshotLimit = 500;

const fixedCourtCount = 4;

const coachSlotWidth = 64;

const timeColumnWidth = 64;

const mobileCoachSlotWidth = 92;

const dashboardPageSize = 5;

const memberListPageSize = 10;

const membershipProductPageSize = 10;

const billingPageSize = 15;

const scheduleDays = ["월", "화", "수", "목", "금", "토", "일"];

const scheduleBlockMinutes = 10;

const adminScheduleMinWeekOffset = -104;

const adminScheduleMaxWeekOffset = 156;

const SERVER_PAYMENT_REFRESH_STALE_MS = 120_000;

const supabasePublicSummaryTable = "tn_app_readiness_snapshots";

const operationsRememberStorageKey = "tennis-note-operations-remember-login";

const operationsProfileCacheStorageKey = "tennis-note-operations-profile-cache";

const ADMIN_AUTH_RECHECK_STALE_MS = 5 * 60 * 1000;

const adminOperationalCacheDbName = "tennis-note-admin-operational-cache";

const adminOperationalCacheStoreName = "snapshots";

const adminOperationalCacheMaxAgeMs = 12 * 60 * 60 * 1000;

const storageKey = "tennis-note-admin-demo-v1";

const sharedStorageKey = "tennis-note-shared-demo-v1";

const paymentConfigKey = "tennis-note-payment-config";

const liveSchedulePolicyKey = "app_schedule_policy";

const adminSecuritySettingsKey = "admin_security_v1";

const holdingPolicyKey = "holding_policy";

const notificationPolicyKey = "notification_policy_v1";

const lessonPolicySettingsKey = "lesson_policy_rules_v1";

const policyVersionSettingsKey = "membership_policy_versions_v1";

const policyVersionEditorState = {
  policyId: "",
};

const memberAdminEditTimeoutMs = 15 * 60 * 1000;

const adminLayoutSettingKey = "tennisnote_admin_layout_v1";

const adminLayoutLocalKey = "tennis-note-admin-layout-v1";

const adminPinHashVersion = "tn-admin-lock-v1";

const legacyDefaultAdminPin = "0000";

const noticeMediaBucket = "tennisnote-notice-media";

const importWorkbookVersion = "2.1";

const importGuideSheetName = "작성안내";

const importMemberSheetName = "회원DB";

const importScheduleSheetName = "정규시간표";

const importReviewSheetName = "검토대기";

const importPaymentReviewSheetName = "결제검토";

const requiredImportColumns = ["회원명", "담당코치", "회원권명", "총횟수", "사용횟수", "잔여횟수"];

const numericImportColumns = ["수업분", "주횟수", "총횟수", "사용횟수", "잔여횟수", "결제금액"];

const money = new Intl.NumberFormat("ko-KR");

const discountStatusToServer = { "사용": "active", "검토": "review", "중지": "disabled", "보관": "archived" };

const discountStatusFromServer = { active: "사용", review: "검토", disabled: "중지", archived: "보관" };

const discountPaymentToServer = { "카드/현금": "card_cash", "카드": "card_only", "현금": "cash_only" };

const discountPaymentFromServer = { card_cash: "카드/현금", card_only: "카드", cash_only: "현금" };

const discountBurdenToServer = { "센터 부담": "branch", "코치 부담": "coach", "공동 부담": "shared" };

const discountBurdenFromServer = { branch: "센터 부담", coach: "코치 부담", shared: "공동 부담" };

const ACCOUNT_DELETION_STALE_MS = 16 * 60 * 1000;

const memberScheduleDayOrder = [1, 2, 3, 4, 5, 6, 0];

const staleReadyPaymentMs = 60 * 60 * 1000;

const ADMIN_LIVE_REFRESH_INTERVAL_MS = 300_000;

const ADMIN_LIVE_REFRESH_STALE_MS = 120_000;
