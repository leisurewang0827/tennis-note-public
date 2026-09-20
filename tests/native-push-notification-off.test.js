import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function functionSource(relativePath, name) {
  const source = readFileSync(join(root, relativePath), "utf8");
  const start = source.indexOf(`async function ${name}(`);
  const next = source.indexOf("\nasync function ", start + 1);
  assert.notEqual(start, -1, `${name} 시작을 찾지 못했습니다.`);
  return source.slice(start, next === -1 ? source.length : next);
}

function nativeContext(kind, readiness) {
  const states = [];
  const calls = { bind: 0, channel: 0, permission: 0, register: 0, rpc: 0 };
  const plugin = {
    async createChannel() { calls.channel += 1; },
    async checkPermissions() { calls.permission += 1; return { receive: "granted" }; },
    async requestPermissions() { return { receive: "granted" }; },
    async register() { calls.register += 1; },
  };
  const context = {
    window: {
      TennisNoteNativePushReadiness: async () => readiness,
      TennisNoteDataClient: {
        getSession: () => ({ access_token: "fixture" }),
        rpc: async () => { calls.rpc += 1; },
      },
    },
    state: kind === "member"
      ? { member: { profileId: "member-fixture" }, accountDeletionRequest: null }
      : { liveProfileId: "coach-fixture" },
    nativeAppPlatform: () => "android",
    nativeCoachAppPlatform: () => "android",
    nativePushPlugin: () => plugin,
    nativeCoachPushPlugin: () => plugin,
    accountDeletionBlocksNotifications: () => false,
    pushPreferenceEnabled: () => true,
    coachPushPreferenceEnabled: () => true,
    setPushNotificationState: (...args) => states.push(args),
    setCoachPushNotificationState: (...args) => states.push(args),
    bindNativePushListeners: async () => { calls.bind += 1; },
    bindNativeCoachPushListeners: async () => { calls.bind += 1; },
    scheduleNativeCoachPushPrimer: () => undefined,
  };
  vm.createContext(context);
  const relativePath = kind === "member"
    ? "app/tennis-note-member-app/data/push.js"
    : "app/tennis-note-coach-app/data/push.js";
  const name = kind === "member" ? "syncNativePushRegistration" : "syncNativeCoachPushRegistration";
  vm.runInContext(functionSource(relativePath, name), context);
  return { context, states, calls, name };
}

for (const kind of ["member", "coach"]) {
  test(`${kind}: Android 12 이하에서 OS 알림 OFF를 구성 오류보다 먼저 안내한다`, async () => {
    const fixture = nativeContext(kind, {
      ready: false,
      reason: "notifications_disabled",
      notificationsEnabled: false,
      runtimePermissionRequired: false,
    });
    const result = await fixture.context[fixture.name]({ id: `${kind}-fixture` });
    assert.equal(result, false);
    assert.deepEqual(fixture.states.at(-1), [
      "denied",
      "휴대폰 알림이 꺼져 있음",
      "휴대폰 설정에서 Tennis Note 알림을 허용해 주세요.",
    ]);
    assert.deepEqual(fixture.calls, { bind: 0, channel: 0, permission: 0, register: 0, rpc: 0 });
  });

  test(`${kind}: Firebase 준비 실패는 계속 fail-closed한다`, async () => {
    const fixture = nativeContext(kind, {
      ready: false,
      reason: "firebase_unavailable",
      notificationsEnabled: true,
      runtimePermissionRequired: false,
    });
    const result = await fixture.context[fixture.name]({ id: `${kind}-fixture` });
    assert.equal(result, false);
    assert.equal(fixture.states.at(-1)?.[0], "unavailable");
    assert.deepEqual(fixture.calls, { bind: 0, channel: 0, permission: 0, register: 0, rpc: 0 });
  });

  test(`${kind}: Android 13 권한 흐름을 Android 12 OFF로 오분류하지 않는다`, async () => {
    const fixture = nativeContext(kind, {
      ready: false,
      reason: "runtime_permission_required",
      notificationsEnabled: false,
      runtimePermissionRequired: true,
    });
    const result = await fixture.context[fixture.name]({ id: `${kind}-fixture` });
    assert.equal(result, false);
    assert.equal(fixture.states.at(-1)?.[0], "unavailable");
    assert.deepEqual(fixture.calls, { bind: 0, channel: 0, permission: 0, register: 0, rpc: 0 });
  });
}
