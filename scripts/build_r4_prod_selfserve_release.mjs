import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

export const digest = value => createHash("sha256").update(value).digest("hex");
export function validatePublicConfiguration(bytes, plan) {
  assert.equal(digest(bytes), plan.configSha256, "OPERATING_CONFIG_DRIFT");
  const match = bytes.match(/window\.TENNISNOTE_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/);
  assert.ok(match, "PUBLIC_RUNTIME_CONFIG_REQUIRED");
  const runtime = JSON.parse(match[1]);
  assert.equal(runtime.environment, "production");
  assert.equal(runtime.supabaseUrl, "https://" + plan.project + ".supabase.co");
  assert.equal(runtime.projectFingerprint, plan.fingerprint);
  assert.ok(bytes.match(/window\.TENNIS_NOTE_PAYMENT_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/), "PAYMENT_CONFIG_REQUIRED");
  const key = runtime.supabasePublishableKey || runtime.supabaseAnonKey;
  assert.equal(typeof key, "string");
  if (key.split(".").length === 3) {
    assert.equal(JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role, "anon");
  } else {
    assert.ok(key.startsWith("sb_publishable_"));
  }
  assert.equal(/service_role|serviceRoleKey|PORTONE_API_SECRET|SUPABASE_SERVICE_ROLE_KEY|static_review_only|compilation_only/.test(bytes), false, "NON_PUBLIC_OR_SYNTHETIC_CONFIG");
  return runtime;
}
export function assetManifest(folder) {
  const walk = (dir, prefix = "") => readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0).flatMap(entry => entry.isDirectory()
    ? walk(join(dir, entry.name), prefix + entry.name + "/")
    : [[prefix + entry.name, digest(readFileSync(join(dir, entry.name)))]]);
  return Object.fromEntries(walk(folder));
}
export async function buildRelease({ repository = process.cwd(), ref = "HEAD", output = "dist/admin" } = {}) {
  const repo = resolve(repository);
  const read = (source, path) => execFileSync("git", ["-C", repo, "show", source + ":" + path], { encoding: "utf8", maxBuffer: 6e6 });
  const plan = JSON.parse(read(ref, "docs/tennisnote-r4-prod-selfserve-release-approval.json"));
  assert.equal(plan.runtimeSource, "c20639b1521e8bc8b4e520ade96bd2c5a4e2faf3");
  assert.equal(plan.operatingBase, "69c2f77161bf57ebc3e2efa3bcf061e1d5e6a1da");
  const manifest = JSON.parse(read(plan.runtimeSource, "docs/tennisnote-r4-prod-selfserve-candidate.json"));
  assert.equal(manifest.privateCheckpoint.sha, plan.privateSqlSource);
  const get = async url => {
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, "PUBLIC_SOURCE_UNAVAILABLE");
    return response.text();
  };
  const current = JSON.parse(await get(plan.origin + "/r4-admin-release.json"));
  const recovery = JSON.parse(await get("https://7b4c1013.tennisnote-admin.pages.dev/r4-admin-release.json"));
  assert.equal(current.sourceSha, plan.operatingBase, "OPERATING_SOURCE_DRIFT");
  assert.equal(recovery.sourceSha, plan.operatingBase, "RECOVERY_SOURCE_DRIFT");
  const config = await get(plan.origin + "/shared/config.local.js");
  const runtime = validatePublicConfiguration(config, plan);
  const temp = mkdtempSync(join(tmpdir(), "tn-r4-release-"));
  const tar = join(temp, "source.tar");
  // 전체 저장소나 보호 파일은 복사하지 않는다. 검증된 운영 기반의 허용 경로만 읽는다.
  execFileSync("git", ["-C", repo, "archive", "--output=" + tar, plan.operatingBase,
    "app/admin", "app/shared", "app/tennis-note-member-app/assets", "app/tennis-note-legal", "app/release.json",
    "commerce.html", "support.html", "delete-account.html", "scripts/build_cloudflare_pages.py"], { stdio: "pipe", windowsHide: true });
  execFileSync("tar", ["-xf", tar, "-C", temp], { stdio: "pipe", windowsHide: true });
  for (const [path, expected] of Object.entries(manifest.effectiveChangedRuntime)) {
    assert.ok(path.startsWith("app/admin/"));
    const bytes = read(plan.runtimeSource, path);
    assert.equal(digest(bytes), expected, "FROZEN_RUNTIME_DRIFT");
    writeFileSync(join(temp, path), bytes);
  }
  // 컴파일용 합성 공개 설정은 새 산출물에서 현 운영 공개 설정 bytes로 교체한다.
  // 기존 REVIEW_ONLY 산출물을 읽거나 표식을 제거해 재사용하지 않는다.
  const env = { ...process.env, TENNISNOTE_ENVIRONMENT: "production", TENNISNOTE_PAYMENTS_ENABLED: "true",
    TENNISNOTE_SUPABASE_URL: runtime.supabaseUrl, TENNISNOTE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_artifact_compilation_only",
    TENNISNOTE_PAYMENT_MODE: "multi", TENNISNOTE_ALLOWED_PAYMENT_METHODS: "tosspay,kakaopay", TENNISNOTE_BANK_TRANSFER_ENABLED: "true",
    TENNISNOTE_PORTONE_STORE_ID: "00000000-0000-4000-8000-000000000001", TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY: "00000000-0000-4000-8000-000000000002",
    TENNISNOTE_PORTONE_KAKAOPAY_CHANNEL_KEY: "00000000-0000-4000-8000-000000000003", TENNISNOTE_SINGLE_SHEET_IMPORT_MODE: "apply", TENNISNOTE_SINGLE_SHEET_IMPORT_REVERSE_ENABLED: "false" };
  const built = join(temp, "dist/admin");
  try {
    execFileSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"), [join(temp, "scripts/build_cloudflare_pages.py"), "--target", "admin", "--output", built], { cwd: temp, env, stdio: "pipe", windowsHide: true });
  } catch { throw new Error("ADMINISTRATOR_COMPILATION_FAILED_NO_SENSITIVE_LOG"); }
  writeFileSync(join(built, "shared/config.local.js"), config);
  writeFileSync(join(built, "r4-admin-release.json"), JSON.stringify({ sourceSha: plan.runtimeSource, surface: "administrator", configSha256: digest(config), candidateSha256: manifest.candidateSha256 }) + "\n");
  assert.equal(existsSync(join(built, "r4-review-only.json")), false);
  for (const app of ["tennis-note-member-app", "tennis-note-coach-app"]) assert.equal(existsSync(join(built, app, "index.html")), false);
  const discovered = assetManifest(built);
  assert.equal(Object.keys(discovered).length, plan.assetCount);
  assert.deepEqual([...plan.assetOrder].sort(), Object.keys(discovered).sort(), "FROZEN_ASSET_SET_DRIFT");
  // 사전 승인 영수증의 순서를 명시하여 Windows/Linux 열거 순서 차이를 제거한다.
  const assets = Object.fromEntries(plan.assetOrder.map(path => [path, discovered[path]]));
  assert.equal(digest(JSON.stringify(assets)), plan.artifactSha256, "PREPARED_ARTIFACT_DRIFT");
  assert.equal(digest(await get(plan.origin + "/shared/config.local.js")), plan.configSha256, "CONFIG_CHANGED_DURING_BUILD");
  assert.equal(JSON.parse(await get(plan.origin + "/r4-admin-release.json")).sourceSha, plan.operatingBase, "SOURCE_CHANGED_DURING_BUILD");
  const destination = resolve(repo, output);
  assert.equal(destination, resolve(repo, "dist/admin"), "ADMIN_ONLY_OUTPUT_REQUIRED");
  assert.equal(existsSync(destination), false, "EXISTING_ARTIFACT_DO_NOT_OVERWRITE");
  mkdirSync(resolve(repo, "dist"), { recursive: true });
  cpSync(built, destination, { recursive: true, force: false, errorOnExist: true });
  return { state: "FROZEN_ADMIN_RELEASE_BUILT", runtimeSource: plan.runtimeSource, configSha256: plan.configSha256, artifactSha256: plan.artifactSha256, assets: plan.assetCount, paymentConfigurationByteIdentical: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const value = prefix => process.argv.find(item => item.startsWith(prefix))?.slice(prefix.length);
  try { console.log(JSON.stringify(await buildRelease({ repository: value("--repository="), ref: value("--ref=") || process.env.GITHUB_SHA || "HEAD" }))); }
  catch (error) { console.error("R4_RELEASE_BLOCKED: " + String(error.message).split("\n")[0].slice(0,220)); process.exitCode = 1; }
}
