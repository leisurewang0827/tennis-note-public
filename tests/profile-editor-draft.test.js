const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const viewFile = "app/tennis-note-member-app/views/profile.js";
const actions = read(viewFile) + "\n" + read("app/tennis-note-member-app/actions/profile.js");
const { restoreEditorDraft, restorePhone, editorDraftManifest, manifest: phoneManifest } = require("./helpers/verified-profile-phone-port.cjs");
const version = JSON.parse(read("app/release.json")).version;
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
function fn(source, name) {
  const found = source.match(new RegExp("^(?:async )?function " + name + "\\([\\s\\S]*?^}", "m"));
  assert(found, name); return found[0];
}
test("스타일·설문 렌더는 승인 원본 두 함수와 exact hash, 기존 golden 역변환을 보존", () => {
  assert.equal(editorDraftManifest.privateSourceSha, "7168f6722958c9b65ebfa0f2cffeac1336f22b93");
  assert.equal(editorDraftManifest.files.length, 1);
  const row = editorDraftManifest.files[0], source = read(viewFile);
  assert.equal(row.path, viewFile);
  assert.equal(hash(source.replaceAll(version, editorDraftManifest.publicVersion)), row.candidateSha256);
  for (const item of row.functions) assert.equal(hash(fn(source, item.name)), item.sha256);
  assert.equal(hash(restoreEditorDraft(viewFile, source).replaceAll(version, editorDraftManifest.publicVersion)), row.baseSha256);
  const original = phoneManifest.files.find(item => item.path === viewFile);
  assert(original, "기존 승인 프로필 기준 존재");
  assert.equal(hash(restorePhone(viewFile, source).replaceAll(version, phoneManifest.publicVersion)), original.baseSha256);
});
test("새 외부 역변환은 변경·누락·중복을 차단하고 실제 정렬 검사에 먼저 등록", () => {
  const row = editorDraftManifest.files[0], source = read(viewFile), hunk = row.hunks[0];
  for (const drift of [source + "\n", source.replace(hunk.after, ""), source.replace(hunk.after, () => hunk.after + hunk.after)])
    assert.throws(() => restorePhone(viewFile, drift), /profile editor candidate drift/);
  const helper = read("tests/helpers/verified-profile-phone-port.cjs");
  assert(helper.includes("text = restoreEditorDraft(file, text, inputVersion)"));
  const alignment = read("scripts/check_tennisnote_dev_prod_alignment.py");
  assert(alignment.indexOf('"profile-editor-draft-source-parity.json", port["publicVersion"]')
    < alignment.indexOf('"profile-durable-readback-source-parity.json", port["publicVersion"]'));
});
test("AUTH-02 배경 갱신은 열린 스타일·설문 초안과 저장 payload를 보존", async () => {
  const fields = [
    ["profileHand", "hand", "dominant_hand", "오른손", "왼손"],
    ["profileBackhand", "backhand", "backhand_style", "투핸드 백핸드", "원핸드 백핸드"],
    ["profileStartedAt", "startedAt", "tennis_started_on", "2001-01-01", "2002-02-02"],
    ["profileGoal", "goal", "tennis_goal", "합성 이전 목표", "합성 입력 목표"],
    ["profileStyleMemo", "styleMemo", "play_style_memo", "합성 이전 메모", "합성 입력 메모"],
    ["profileSelfNtrp", "selfNtrp", "self_ntrp", "2.5", "3"],
    ["profileCoachNtrp", "coachNtrp", null, "측정 전", "3.0"],
  ];
  for (const role of ["member", "coach"]) {
    const nodes = Object.fromEntries(fields.map(([id, , , stored]) => [id, { value: stored }]));
    nodes.profileEditorSheet = { hidden: false };
    nodes.ntrpSurveyQuestions = { writes: 0 };
    Object.defineProperty(nodes.ntrpSurveyQuestions, "innerHTML", { set() { this.writes++; } });
    let captured;
    const c = { state: { member: { role, status: "active", name: "합성 검증" },
        profile: Object.fromEntries(fields.map(([, key, , stored]) => [key, stored])), ticketHistory: [] },
      document: { activeElement: null }, $: selector => nodes[selector.slice(1)],
      formatIdentityPhone: value => value, syncNtrpResultFromCoach() {}, renderProfileAvatar() {},
      renderDiscountCouponWallet() {}, renderPushNotificationSettings() {}, renderAccountDeletionSettings() {},
      ntrpReferences: [], ntrpQuickLevels: [], ntrpSurveyQuestions: [],
      collectNtrpSurvey: () => ({ answers: { synthetic: 3 } }),
      persistIdentityProfile: async payload => { captured = payload; throw Error("synthetic_stop_after_capture"); },
      profileSaveErrorMessage: () => "합성 캡처 종료", setNicknameStatus() {}, showToast() {},
    };
    vm.createContext(c); vm.runInContext("let profileSaveErrorToast = null;", c);
    for (const name of ["renderProfile", "renderNtrpSurvey", "saveProfileInfoOnce"]) vm.runInContext(fn(actions, name), c);
    for (const [id, , , , draft] of fields) nodes[id].value = draft;
    for (let refresh = 0; refresh < 3; refresh++) {
      c.renderProfile();
      for (const [id, , , , draft] of fields) assert.equal(nodes[id].value, draft);
    }
    assert.equal(nodes.ntrpSurveyQuestions.writes, 0);
    assert.equal(await c.saveProfileInfoOnce(), false);
    for (const [, , serverKey, , draft] of fields) if (serverKey) assert.equal(String(captured.profileStyle[serverKey]), draft);
    assert.equal(c.state.member.role, role); assert.equal(nodes.profileEditorSheet.hidden, false);
    nodes.profileEditorSheet.hidden = true; c.renderProfile();
    for (const [id, , , stored] of fields) assert.equal(nodes[id].value, stored);
    assert.equal(nodes.ntrpSurveyQuestions.writes, 1);
    c.document.activeElement = nodes.profileHand; nodes.profileHand.value = "왼손"; c.renderProfile();
    assert.equal(nodes.profileHand.value, "왼손");
  }
});
