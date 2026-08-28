import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const releaseJson = JSON.parse(fs.readFileSync(new URL("../app/release.json", import.meta.url), "utf8"));
const releaseScript = fs.readFileSync(new URL("../app/shared/tennisnote-release.js", import.meta.url), "utf8");

function block(name) {
  const match = releaseScript.match(new RegExp(`${name}: \\{([\\s\\S]*?)\\n    \\},`));
  assert.ok(match, `${name} block must exist`);
  return match[1];
}

function textValue(source, name) {
  const match = source.match(new RegExp(`${name}: "([^"]+)"`));
  assert.ok(match, `${name} must exist`);
  return match[1];
}

function numberValue(source, name) {
  const match = source.match(new RegExp(`${name}: (\\d+)`));
  assert.ok(match, `${name} must exist`);
  return Number(match[1]);
}

test("native prepared and store-available metadata stay consistent", () => {
  const nativeShell = block("nativeShell");
  const store = block("store");

  for (const platform of ["android", "ios"]) {
    const platformVersion = `${platform}Version`;
    const platformBuild = `${platform}Build`;
    assert.equal(
      releaseJson.nativePlatforms[platform].preparedVersion,
      textValue(nativeShell, platformVersion),
      `${platform} prepared version`,
    );
    assert.equal(
      releaseJson.nativePlatforms[platform].preparedBuild,
      numberValue(nativeShell, platformBuild),
      `${platform} prepared build`,
    );
    assert.equal(
      releaseJson.nativePlatforms[platform].latestVersion,
      textValue(store, platformVersion),
      `${platform} store version`,
    );
    assert.equal(
      releaseJson.nativePlatforms[platform].latestBuild,
      numberValue(store, platformBuild),
      `${platform} store build`,
    );
  }
});
