import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("개발계 빌드는 운영 결제 비밀 없이 생성되고 화면에 개발계임을 표시한다", () => {
  const relativeOutput = "dist/test-dev-member";
  const output = join(root, relativeOutput);
  rmSync(output, { recursive: true, force: true });
  const result = spawnSync(process.env.TENNISNOTE_PYTHON || "python", [
    "scripts/build_cloudflare_pages.py",
    "--target", "member",
    "--output", relativeOutput,
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      TENNISNOTE_ENVIRONMENT: "development",
      TENNISNOTE_PAYMENTS_ENABLED: "false",
      TENNISNOTE_SUPABASE_URL: "https://dev-example.supabase.co",
      TENNISNOTE_SUPABASE_PUBLISHABLE_KEY: "dev-test-key",
      TENNISNOTE_PORTONE_STORE_ID: "",
      TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY: "",
      TENNISNOTE_BANK_TRANSFER_ENABLED: "false",
      TENNISNOTE_SINGLE_SHEET_IMPORT_MODE: "apply",
      TENNISNOTE_SINGLE_SHEET_IMPORT_REVERSE_ENABLED: "true",
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const config = readFileSync(join(output, "shared/config.local.js"), "utf8");
  const html = readFileSync(join(output, "index.html"), "utf8");
  assert.match(config, /"environment": "development"/);
  assert.match(config, new RegExp(`"projectFingerprint": "${createHash("sha256").update("dev-example").digest("hex")}"`));
  assert.match(config, /"singleSheetImportMode": "apply"/);
  assert.match(config, /"singleSheetImportReverseEnabled": true/);
  assert.match(config, /"enabled": false/);
  assert.match(config, /"allowedMethods": \[\]/);
  assert.doesNotMatch(config, /test-store-id|test-tosspay-channel/);
  assert.match(html, /개발계 · 실제 결제·푸시 차단/);
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  rmSync(output, { recursive: true, force: true });
});

test("회원 결제 런타임은 개발계의 결제 차단을 우회하지 않는다", () => {
  const storage = readFileSync(join(root, "app/tennis-note-member-app/storage.js"), "utf8");
  const payment = readFileSync(join(root, "app/tennis-note-member-app/domain/payment.js"), "utf8");
  assert.match(storage, /enabled:\s*browserConfig\.enabled !== false/);
  assert.match(payment, /if \(config\.enabled === false\) return \[\];/);
});

test("개발계 배포는 dev 브랜치와 별도 Cloudflare 프로젝트만 사용한다", () => {
  const workflow = readFileSync(join(root, ".github/workflows/deploy-cloudflare-pages-dev.yml"), "utf8");
  assert.match(workflow, /branches:\s*\[dev\]/);
  assert.match(workflow, /environment:\s*development/);
  assert.match(workflow, /TENNISNOTE_PAYMENTS_ENABLED:\s*"false"/);
  assert.match(workflow, /TENNISNOTE_SINGLE_SHEET_IMPORT_MODE:\s*apply/);
  assert.match(workflow, /TENNISNOTE_SINGLE_SHEET_IMPORT_REVERSE_ENABLED:\s*"true"/);
  assert.match(workflow, /DEV_TENNISNOTE_SUPABASE_URL/);
  assert.match(workflow, /project-name=tennisnote-app-dev --branch=dev/);
  assert.match(workflow, /project-name=tennisnote-admin-dev --branch=dev/);
  assert.doesNotMatch(workflow, /project-name=tennisnote-app --branch=main/);
  assert.doesNotMatch(workflow, /project-name=tennisnote-admin --branch=main/);
});
