import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

test("가입 동의의 서비스 이용약관이 실제 페이지를 가리킨다", () => {
  const termsPath = path.join(ROOT, "app/tennis-note-legal/terms.html");
  assert.equal(fs.existsSync(termsPath), true, "서비스 이용약관 페이지가 없습니다");

  const member = read("app/tennis-note-member-app/index.html");
  assert.match(member, /href="\.\.\/tennis-note-legal\/terms\.html"[^>]*>이용약관<\/a>/);
  assert.doesNotMatch(member, /href="\.\.\/tennis-note-legal\/commerce\.html"[^>]*>이용약관<\/a>/);
});

test("개인정보처리방침은 초안 표시 없이 최신 처리 항목과 운영자 연락처를 함께 공개한다", () => {
  const privacy = read("app/tennis-note-legal/privacy.html");
  assert.doesNotMatch(privacy, /초안/);
  assert.match(privacy, /Android 입금 알림/);
  assert.match(privacy, /Apple/);
  assert.match(privacy, /테니스클럽하우스/);
  assert.match(privacy, /0507-1325-9052/);
});

test("루트 개인정보 주소는 앱의 정식 문서로 안내한다", () => {
  const rootPrivacy = read("privacy.html");
  assert.match(rootPrivacy, /url=\.\/app\/tennis-note-legal\/privacy\.html/);
});

test("루트 이용약관 주소는 앱의 정식 문서로 안내한다", () => {
  const rootTerms = read("terms.html");
  assert.match(rootTerms, /url=\.\/app\/tennis-note-legal\/terms\.html/);
});

test("GitHub Pages 배포에도 루트 이용약관을 포함한다", () => {
  const workflow = read(".github/workflows/deploy-pages.yml");
  assert.match(workflow, /cp index\.html[^\n]*terms\.html[^\n]*_site\//);
});
