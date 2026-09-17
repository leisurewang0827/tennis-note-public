import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("Android Firebase 준비 전 push register는 공급자 호출 없이 중단한다", async () => {
  let registerCalls = 0;
  const plugins = {
    PushNotifications: { register: async () => { registerCalls += 1; } },
    TennisNoteNativeRuntime: { getPushReadiness: async () => ({
      ready: false,
      reason: "firebase_not_ready",
      notificationsEnabled: true,
      runtimePermissionRequired: false,
    }) },
  };
  const context = vm.createContext({
    window: {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => "android",
        registerPlugin: (name) => plugins[name],
      },
    },
    Error,
    Proxy,
    String,
  });

  vm.runInContext(source("app/shared/tennisnote-native-push.js"), context);
  await assert.rejects(
    context.window.TennisNoteNativePush.register(),
    (error) => error.message === "native_push_unavailable" && error.code === "firebase_not_ready",
  );
  assert.equal(registerCalls, 0);
});

test("Android Firebase 준비 완료 뒤에만 push register를 호출한다", async () => {
  let registerCalls = 0;
  const plugins = {
    PushNotifications: { register: async () => { registerCalls += 1; return { ok: true }; } },
    TennisNoteNativeRuntime: { getPushReadiness: async () => ({
      ready: true,
      notificationsEnabled: true,
      runtimePermissionRequired: false,
    }) },
  };
  const context = vm.createContext({
    window: {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => "android",
        registerPlugin: (name) => plugins[name],
      },
    },
    Error,
    Proxy,
    String,
  });

  vm.runInContext(source("app/shared/tennisnote-native-push.js"), context);
  await context.window.TennisNoteNativePush.register();
  assert.equal(registerCalls, 1);
});

test("member와 coach 자동 등록은 Android readiness를 먼저 확인한다", () => {
  const member = source("app/tennis-note-member-app/data/push.js");
  const coach = source("app/tennis-note-coach-app/data/push.js");
  assert.match(member, /TennisNoteNativePushReadiness/);
  assert.match(member, /앱 알림 구성에 문제가 있어 수업 기능만 안전하게 계속 사용합니다/);
  assert.match(coach, /TennisNoteNativePushReadiness/);
  assert.match(coach, /앱 알림 구성에 문제가 있어 코치 업무는 안전하게 계속 사용할 수 있습니다/);
});
