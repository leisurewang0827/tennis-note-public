import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const releaseJson = JSON.parse(fs.readFileSync(new URL("../app/release.json", import.meta.url), "utf8"));
const releaseScript = fs.readFileSync(new URL("../app/shared/tennisnote-release.js", import.meta.url), "utf8");

test("공개 스토어 정보와 준비본 미확인 상태를 셸 선언과 분리한다", () => {
  const window = {};
  vm.runInNewContext(releaseScript, { window, document: { readyState: "loading", addEventListener() {} } });
  const { store, prepared } = window.TENNIS_NOTE_RELEASE;
  assert.equal(prepared.availability, "not_verified");

  for (const platform of ["android", "ios"]) {
    const platformVersion = `${platform}Version`;
    const platformBuild = `${platform}Build`;
    assert.equal(
      releaseJson.nativePlatforms[platform].preparedVersion,
      null,
      `${platform} prepared version`,
    );
    assert.equal(
      releaseJson.nativePlatforms[platform].preparedBuild,
      null,
      `${platform} prepared build`,
    );
    assert.equal(
      releaseJson.nativePlatforms[platform].latestVersion,
      store[platformVersion],
      `${platform} store version`,
    );
    assert.equal(
      releaseJson.nativePlatforms[platform].latestBuild,
      store[platformBuild],
      `${platform} store build`,
    );
    assert.equal(releaseJson.nativePlatforms[platform].availability, store[`${platform}Availability`]);
    assert.equal(releaseJson.nativePlatforms[platform].preparedAvailability, prepared.availability);
  }
});
