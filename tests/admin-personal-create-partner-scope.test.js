const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const forms = fs.readFileSync(path.join(root, "app/admin/forms/common.js"), "utf8");
const actions = fs.readFileSync(path.join(root, "app/admin/actions/member.js"), "utf8");
const match = forms.match(/function normalizeMemberCreatePartnerPayload\(payload, product\) \{[\s\S]*?\n\}/);
assert.ok(match, "production helper must be present");
const normalize = vm.runInNewContext(`(${match[0]})`);
const keys = ["partnerUserId", "partnerMode", "partnerName", "partnerPhone", "partnerBirthYear", "partnerGender"];
const make = (lessonType, mode) => ({ lessonType, partnerUserId: "synthetic-id", partnerMode: mode,
  partnerName: "synthetic-name", partnerPhone: "synthetic-contact", partnerBirthYear: 2000, partnerGender: "x" });

test("personal create strips inactive partner fields and keeps facts", () => {
  const payload = { ...make("one_on_one", "new"), startsOn: "2026-11-01" };
  normalize(payload, { group_size: 1 });
  for (const key of keys) assert.equal(payload[key], null);
  assert.equal(payload.startsOn, "2026-11-01");
});
for (const mode of ["new", "existing"]) {
  test(`group ${mode} keeps partner input for existing guards`, () => {
    const payload = make("one_on_two", mode);
    const before = { ...payload };
    normalize(payload, { group_size: 2 });
    assert.deepEqual(payload, before);
  });
}
test("unknown, inconsistent and invalid group input are not silently corrected", () => {
  for (const [product, type] of [[null, "one_on_one"], [{ group_size: 2 }, "one_on_one"], [{ group_size: 1 }, "one_on_two"]]) {
    const payload = make(type, "new");
    payload.partnerPhone = "";
    const before = { ...payload };
    normalize(payload, product);
    assert.deepEqual(payload, before);
  }
});
test("personal and group switches do not erase the source form or group draft", () => {
  const draft = make("one_on_two", "new");
  const personal = { ...draft, lessonType: "one_on_one" };
  normalize(personal, { group_size: 1 });
  const group = { ...draft };
  normalize(group, { group_size: 2 });
  assert.equal(group.partnerMode, "new");
  assert.equal(group.partnerPhone, "synthetic-contact");
});
test("normalization is restricted to create and precedes identity preview", () => {
  const start = actions.indexOf("async function submitMemberManagementForm");
  const call = actions.indexOf("if (isCreate) normalizeMemberCreatePartnerPayload(managementPayload, selectedManagementProduct);", start);
  const preview = actions.indexOf("confirmMemberPurchaseIdentity(form, managementPayload", start);
  assert.ok(start >= 0 && call > start && preview > call);
});
