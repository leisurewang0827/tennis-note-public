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

