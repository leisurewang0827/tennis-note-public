import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const updaterSource = readFileSync(join(root, "app/shared/tennisnote-release-updater.js"), "utf8");

function updater() {
  const window = {
    TENNIS_NOTE_RELEASE: {
      nativeShell: { iosVersion: "1.0.405", iosBuild: 97, androidVersion: "1.0.404", androidBuild: 98 },
    },
    addEventListener() {},
  };
  const document = {
    readyState: "loading",
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: { classList: { add() {}, remove() {} } },
  };
  const context = {
    window,
    document,
    navigator: {},
    location: { pathname: "/", href: "https://example.test/" },
    URL,
    URLSearchParams,
    fetch: async () => ({ ok: false }),
    setInterval() {},
    clearInterval() {},
    setTimeout() {},
    console,
  };
  vm.runInNewContext(updaterSource, context);
  return window.TennisNoteReleaseUpdater;
}

const installed = { platform: "ios", version: "1.0.405", build: 97 };
const productionCandidate = JSON.parse(readFileSync(join(root, "app/release.json"), "utf8"));

test("운영 후보는 공개 Android 103만 구버전에 선택 업데이트로 안내한다", () => {
  const android = productionCandidate.nativePlatforms.android;
  assert.equal(android.availability, "available");
  assert.equal(android.latestVersion, "1.0.474");
  assert.equal(android.latestBuild, 103);
  assert.equal(android.preparedVersion, "1.0.474");
  assert.equal(android.preparedBuild, 103);
  const result = updater().evaluateNativeUpdate(productionCandidate, {
    platform: "android", version: "1.0.428", build: 101,
  });
  assert.equal(result.status, "optional");
  assert.equal(result.policy.latestVersion, "1.0.474");
  assert.equal(result.policy.latestBuild, 103);
  assert.equal(result.policy.storeUrl, "https://play.google.com/store/apps/details?id=com.tennisclubhouse.tennisnote");
});

test("현재 Android 103과 더 새 설치본에는 안내하지 않으며 준비본은 공개판이 아니다", () => {
  for (const app of [{ version: "1.0.474", build: 103 }, { version: "1.0.475", build: 104 }]) {
    assert.equal(updater().evaluateNativeUpdate(productionCandidate, { platform: "android", ...app }).status, "current");
  }
  const futurePrepared = structuredClone(productionCandidate);
  Object.assign(futurePrepared.nativePlatforms.android, { preparedVersion: "9.9.999", preparedBuild: 9999 });
  assert.equal(updater().evaluateNativeUpdate(futurePrepared, { platform: "android", version: "1.0.474", build: 103 }).status, "current");
});

test("공개 상태가 미확인으로 바뀌면 Android store 안내는 fail closed한다", () => {
  for (const availability of ["unknown", "prepared", "under_review", ""]) {
    const candidate = structuredClone(productionCandidate);
    candidate.nativePlatforms.android.availability = availability;
    assert.equal(updater().evaluateNativeUpdate(candidate, { platform: "android", version: "1.0.428", build: 101 }).status, "current");
  }
});

test("iOS 공개 101과 기존 안내 정책은 그대로 보존한다", () => {
  assert.deepEqual(productionCandidate.nativePlatforms.ios, {
    minimumVersion: "1.0.260", minimumBuild: 59,
    latestVersion: "1.0.428", latestBuild: 101,
    preparedVersion: "1.0.428", preparedBuild: 101,
    storeUrl: "https://apps.apple.com/app/id6790994818",
  });
  for (const app of [{ version: "1.0.428", build: 101 }, { version: "1.0.474", build: 106 }]) {
    assert.equal(updater().evaluateNativeUpdate(productionCandidate, { platform: "ios", ...app }).status, "current");
  }
});

test("심사 중이거나 준비만 된 빌드는 업데이트로 안내하지 않는다", () => {
  for (const availability of ["prepared", "under_review", "unknown", ""]) {
    const decision = updater().evaluateNativeUpdate({
      nativePlatforms: {
        ios: {
          availability,
          availableVersion: "1.0.419",
          availableBuild: 99,
          minimumVersion: "1.0.419",
          minimumBuild: 99,
        },
      },
    }, installed);
    assert.equal(decision.status, "current");
  }
});

test("스토어에서 실제 다운로드 가능한 새 빌드만 업데이트로 안내한다", () => {
  const optional = updater().evaluateNativeUpdate({
    nativePlatforms: {
      ios: {
        availability: "available",
        availableVersion: "1.0.419",
        availableBuild: 99,
        minimumVersion: "1.0.405",
        minimumBuild: 97,
      },
    },
  }, installed);
  assert.equal(optional.status, "optional");

  const required = updater().evaluateNativeUpdate({
    nativePlatforms: {
      ios: {
        availability: "available",
        availableVersion: "1.0.419",
        availableBuild: 99,
        minimumVersion: "1.0.410",
        minimumBuild: 98,
      },
    },
  }, installed);
  assert.equal(required.status, "required");
});

test("스토어의 다운로드 가능 버전과 설치 버전이 같으면 최신 상태다", () => {
  const decision = updater().evaluateNativeUpdate({
    nativePlatforms: {
      ios: {
        availability: "available",
        availableVersion: "1.0.405",
        availableBuild: 97,
        minimumVersion: "1.0.405",
        minimumBuild: 97,
      },
    },
  }, installed);
  assert.equal(decision.status, "current");
});
