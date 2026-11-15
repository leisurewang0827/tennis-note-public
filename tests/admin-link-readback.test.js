import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app/admin/domain/common.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}
function setup(users) {
  const context = { adminLiveDataState: { users, tickets: [] } };
  vm.createContext(context);
  vm.runInContext(extract("normalizedRpcResult") + "\n" + extract("memberManagementWriteVerification"), context);
  return context.memberManagementWriteVerification;
}
for (const action of ["app_link", "link_existing"]) {
  test(`${action}: 최종 연결 대상과 새 연결 상태로 저장 확인`, () => {
    const verify = setup([{ id: "source", auth_linked: false }, { id: "target", auth_linked: true, auth_user_id: null }]);
    for (const result of [{ targetUserId: "target" }, [{ targetUserId: "target" }], { userId: "target" }]) {
      assert.equal(verify(action, { userId: "source" }, result), "");
    }
    assert.equal(verify(action, { userId: "source" }, { targetUserId: "missing" }), `member_management_write_not_confirmed:${action}`);
    assert.equal(verify(action, { userId: "source" }, {}), `member_management_write_not_confirmed:${action}`);
  });
  test(`${action}: 명시적 미연결과 누락은 실패하고 구버전 연결은 지원`, () => {
    for (const [fields, ok] of [
      [{ auth_linked: false, auth_user_id: "stale" }, false],
      [{ auth_user_id: "legacy" }, true],
      [{ auth_linked: null, auth_user_id: "legacy" }, true],
      [{ auth_linked: false }, false], [{}, false],
    ]) {
      assert.equal(setup([{ id: "target", ...fields }])(action, { userId: "target" }, {}), ok ? "" : `member_management_write_not_confirmed:${action}`);
    }
    assert.equal(setup([])(action, { userId: "target" }, {}), `member_management_write_not_confirmed:${action}`);
  });
}
test("연결 외 작업은 기존 userId 선택 계약 보존", () => {
  const verify = setup([{ id: "target", status: "inactive" }, { id: "other", status: "active" }]);
  assert.equal(verify("deactivate", { userId: "target" }, { targetUserId: "other" }), "");
});
