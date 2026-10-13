import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function yamlBlock(source, start, end) {
  const match = source.match(new RegExp(`^${start}\\r?\\n([\\s\\S]*?)(?=^${end}|$(?![\\s\\S]))`, "m"));
  assert.ok(match, `${start} block missing`);
  return match[1];
}

function assertDevelopmentDeployContract(caller, deploy) {
  const callerTriggers = yamlBlock(caller, "on:", "permissions:");
  const callerJob = yamlBlock(caller, "  deploy-development-after-ci:", "  [a-z][a-z-]*:");
  const deployTriggers = yamlBlock(deploy, "on:", "permissions:");
  const deployJob = yamlBlock(deploy, "  build-and-deploy-development:", "  [a-z][a-z-]*:");

  assert.match(callerTriggers, /^  pull_request:\s*$/m);
  assert.match(callerTriggers, /^  push:\s*\r?\n    branches: \[dev, main\]$/m);
  assert.match(callerJob, /^    if: .*github\.event_name == 'push'.*github\.ref == 'refs\/heads\/dev'.*$/m);
  assert.match(callerJob, /^    needs: build-and-check$/m);
  assert.match(callerJob, /^    uses: \.\/\.github\/workflows\/deploy-cloudflare-pages-dev\.yml$/m);
  assert.match(deployTriggers, /^  workflow_call:\s*$/m);
  assert.doesNotMatch(deployTriggers, /^  (?:push|pull_request|workflow_dispatch):/m);
  assert.match(deployJob, /^    environment: development$/m);
  assert.match(deployJob, /^      TENNISNOTE_ENVIRONMENT: development$/m);
  assert.match(deployJob, /^      TENNISNOTE_PAYMENTS_ENABLED: "false"$/m);
  assert.match(deployJob, /^      TENNISNOTE_PAYMENT_MODE: disabled$/m);
  assert.match(deployJob, /^      TENNISNOTE_BANK_TRANSFER_ENABLED: "false"$/m);
  assert.match(deployJob, /DEV_TENNISNOTE_SUPABASE_URL/);
  assert.match(deployJob, /^          ref: \$\{\{ github\.sha \}\}$/m);
  assert.match(deployJob, /GITHUB_EVENT_NAME'\) != 'push'/);
  assert.match(deployJob, /GITHUB_REF'\) != 'refs\/heads\/dev'/);
  assert.match(deployJob, /git', 'rev-parse', 'HEAD'.*GITHUB_SHA/);
  assert.match(deployJob, /EXPECTED_DEV_SUPABASE_FINGERPRINT/);
  assert.match(deployJob, /project\.startswith\(os\.environ\['EXPECTED_DEV_SUPABASE_FINGERPRINT'\]\)/);
  assert.match(deployJob, /DEV_CLOUDFLARE_ACCOUNT_FINGERPRINT/);
  assert.match(deployJob, /hashlib\.sha256\(account\.encode\(\)\)\.hexdigest\(\) != expected/);
  assert.match(deployJob, /required = \{'tennisnote-app-dev', 'tennisnote-admin-dev'\}/);
  assert.match(deployJob, /required <= projects\.keys\(\)/);
  assert.match(deployJob, /projects\[name\]\.get\('production_branch'\) != 'dev'/);
  const memberDeploy = yamlBlock(deployJob, "      - name: Deploy member development PWA", "      - name:");
  const adminDeploy = yamlBlock(deployJob, "      - name: Deploy administrator development web", "      - name:");
  assert.equal(memberDeploy.trim(), "run: npx --yes wrangler@3.90.0 pages deploy dist/member-dev --project-name=tennisnote-app-dev --branch=dev");
  assert.equal(adminDeploy.trim(), "run: npx --yes wrangler@3.90.0 pages deploy dist/admin-dev --project-name=tennisnote-admin-dev --branch=dev");
  assert.equal((deployJob.match(/pages deploy /g) || []).length, 2);
  assert.doesNotMatch(deploy, /pages project create|project-name=tennisnote-app --branch=main|project-name=tennisnote-admin --branch=main/);
}

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
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const config = readFileSync(join(output, "shared/config.local.js"), "utf8");
  const html = readFileSync(join(output, "index.html"), "utf8");
  assert.match(config, /"environment": "development"/);
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
  const caller = readFileSync(join(root, ".github/workflows/tennisnote-public-ci.yml"), "utf8");
  const deploy = readFileSync(join(root, ".github/workflows/deploy-cloudflare-pages-dev.yml"), "utf8");
  assertDevelopmentDeployContract(caller, deploy);
});

test("개발계 배포는 CI, 브랜치, SHA, 프로젝트 검증이 빠지면 거부한다", () => {
  const caller = readFileSync(join(root, ".github/workflows/tennisnote-public-ci.yml"), "utf8");
  const deploy = readFileSync(join(root, ".github/workflows/deploy-cloudflare-pages-dev.yml"), "utf8");
  const rejectCaller = (from, to) => {
    assert.ok(caller.includes(from));
    assert.throws(() => assertDevelopmentDeployContract(caller.replace(from, to), deploy));
  };
  const rejectDeploy = (from, to) => {
    assert.ok(deploy.includes(from));
    assert.throws(() => assertDevelopmentDeployContract(caller, deploy.replace(from, to)));
  };
  rejectCaller("needs: build-and-check", "needs: optional-check");
  rejectCaller("github.ref == 'refs/heads/dev'", "github.ref == 'refs/heads/main'");
  rejectCaller("uses: ./.github/workflows/deploy-cloudflare-pages-dev.yml", "uses: ./.github/workflows/deploy-other.yml");
  rejectDeploy("  workflow_call:", "  workflow_dispatch:");
  rejectDeploy("ref: ${{ github.sha }}", "ref: dev");
  rejectDeploy("os.environ.get('GITHUB_EVENT_NAME') != 'push'", "os.environ.get('GITHUB_EVENT_NAME') != 'workflow_dispatch'");
  rejectDeploy("os.environ.get('GITHUB_REF') != 'refs/heads/dev'", "os.environ.get('GITHUB_REF') != 'refs/heads/main'");
  rejectDeploy("os.environ.get('GITHUB_SHA')", "'refs/heads/dev'");
  rejectDeploy("project.startswith(os.environ['EXPECTED_DEV_SUPABASE_FINGERPRINT'])", "bool(project)");
  rejectDeploy("projects[name].get('production_branch') != 'dev'", "projects[name].get('production_branch') != 'main'");
  rejectDeploy("required <= projects.keys()", "bool(projects)");
  rejectDeploy("hashlib.sha256(account.encode()).hexdigest() != expected", "not account");
  rejectDeploy('TENNISNOTE_PAYMENTS_ENABLED: "false"', 'TENNISNOTE_PAYMENTS_ENABLED: "true"');
  rejectDeploy("npx --yes wrangler@3.90.0 pages deploy", "npx --yes wrangler@3.90.0 pages project create");
  rejectDeploy("run: npx --yes wrangler@3.90.0 pages deploy dist/member-dev --project-name=tennisnote-app-dev --branch=dev", "run: npx --yes wrangler@3.90.0 pages deploy dist/member-dev --project-name=tennisnote-app --branch=dev\n      # project-name=tennisnote-app-dev --branch=dev");
  rejectDeploy("run: npx --yes wrangler@3.90.0 pages deploy dist/admin-dev --project-name=tennisnote-admin-dev --branch=dev", "run: npx --yes wrangler@3.90.0 pages deploy dist/admin-dev --project-name=tennisnote-admin --branch=dev\n      # project-name=tennisnote-admin-dev --branch=dev");
});
