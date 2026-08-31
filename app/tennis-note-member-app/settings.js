// 저장소 키·버전 문자열·크기 같은 작은 상수.
//
// localStorage 키가 흩어져 있으면 무엇이 쓰이는지 알 수 없어 한곳에 모았다.
// 키는 tennis-note- 로 시작하고 하이픈을 쓴다.
// app.js 에서 본문 그대로 옮겨왔고 전역 선언이라 쓰는 쪽은 예전과 같다.

const brandSplashMinimumDuration = 150;

const days = ["월", "화", "수", "목", "금", "토", "일"];

const listPageSize = 5;

const memberScheduleCoachLaneWidth = 64;

const journalMediaBucket = "tennisnote-journal-media";

const serverJournalSchema = "tennisnote-mobile-journal-v1";

const memberEnrollmentFormVersion = "2026-07-15-v1";

const identityTermsVersion = "2026-08-13-v1";

const identityPrivacyVersion = "2026-07-19-v2";

const memberScheduleMinWeekOffset = -104;

const memberScheduleMaxWeekOffset = 156;

const memberScheduleWorkspaceDays = 31;

const paymentConfigKey = "tennis-note-payment-config";

const adminStorageKey = "tennis-note-admin-demo-v1";

const liveSchedulePolicyKey = "app_schedule_policy";

const holdingPolicyKey = "holding_policy";

const storageKey = "tennis-note-member-live-v1";

const sharedStorageKey = "tennis-note-shared-live-v1";

const appModePreferenceKey = "tennis-note-app-mode";

const legacyDemoStorageKeys = ["tennis-note-member-demo-v1", "tennis-note-coach-demo-v1", "tennis-note-shared-demo-v1"];

const pushDeviceStorageKey = "tennis-note-push-device-id";

const pushPreferenceStorageKey = "tennis-note-push-enabled-v1";

const pushPrimerDeferredStorageKey = "tennis-note-push-primer-deferred-at-v1";

const bankNotificationDeviceStorageKey = "tennis-note-bank-notification-device-v1";

const membershipPurchaseSteps = ["상품", "코치·시간", "결제"];

const defaultPaymentOperatingMode = "tosspay_only";

const defaultAllowedPaymentMethods = ["tosspay"];

const MEMBER_LIVE_REFRESH_STALE_MS = 20_000;

// 비회원이 들어올 때 담아두는 의도. 외부 OAuth가 앱을 다시 띄워도
// 최소 선택만 짧게 복원하고, 가격이나 개인정보는 저장하지 않는다.
const onboardingIntentStorageKey = "tennis-note-onboarding-intent-v1";
const onboardingIntentResumeStorageKey = "tennis-note-onboarding-intent-resume-v1";
const onboardingIntentResumeTtlMs = 30 * 60 * 1000;
