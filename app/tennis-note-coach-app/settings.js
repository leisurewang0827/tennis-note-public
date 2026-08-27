// 저장소 키·버전 문자열·크기 같은 작은 상수.
//
// localStorage 키가 흩어져 있으면 무엇이 쓰이는지 알 수 없어 한곳에 모았다.
// 키는 tennis-note- 로 시작하고 하이픈을 쓴다.
// app.js 에서 본문 그대로 옮겨왔고 전역 선언이라 쓰는 쪽은 예전과 같다.

const brandSplashMinimumDuration = 150;

const storageKey = "tennis-note-coach-live-v1";

const sharedStorageKey = "tennis-note-shared-live-v1";

const appModePreferenceKey = "tennis-note-app-mode";

const coachPushDeviceStorageKey = "tennis-note-push-device-id";

const coachPushPreferenceStorageKey = "tennis-note-push-enabled-v1";

const coachPushPrimerDeferredStorageKey = "tennis-note-coach-push-primer-deferred-at-v1";

const legacyDemoStorageKeys = ["tennis-note-member-demo-v1", "tennis-note-coach-demo-v1", "tennis-note-shared-demo-v1"];

const adminStorageKey = "tennis-note-admin-demo-v1";

const liveSchedulePolicyKey = "app_schedule_policy";

const serverJournalSchema = "tennisnote-mobile-journal-v1";

const journalMediaBucket = "tennisnote-journal-media";

const coachScheduleLaneWidth = 64;

const memberPageSize = 10;

const scheduleDays = ["월", "화", "수", "목", "금", "토", "일"];

const scheduleBlockMinutes = 10;

const coachScheduleMinWeekOffset = -104;

const coachScheduleMaxWeekOffset = 156;

const completedFeedbackVisibilityMs = 24 * 60 * 60 * 1000;

const COACH_LIVE_REFRESH_INTERVAL_MS = 60_000;

const COACH_LIVE_REFRESH_STALE_MS = 30_000;
