import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

export const template = readFileSync(new URL("./standing.sql", import.meta.url), "utf8").replace(/\r\n/g,"\n");
const targets = Object.freeze({
  production: ["tn_r4_prod_member_catalog", "tn_r4_prod_member_private_catalog", "tn_r4_prod_admin_standing_catalog", "admin"],
  development: ["tn_r4_member_catalog", "tn_r4_dev_member_private_catalog", "tn_r4_dev_admin_standing_catalog", "admin"],
});

export function bindStanding({environment, actor, profile, branch, baseRpc}) {
  assert.ok(Object.hasOwn(targets, environment), "UNKNOWN_CATALOG_TARGET");
  for (const value of [actor, profile, branch, baseRpc]) assert.match(value, /^[a-f0-9]{64}$/);
  const [CATALOG, OLD_RPC, RPC, ROLE] = targets[environment];
  const values = {CATALOG, OLD_RPC, RPC, ROLE, ACTOR_SHA:actor, PROFILE_SHA:profile, BRANCH_SHA:branch, BASE_RPC_SHA:baseRpc};
  return template.replace(/__([A-Z_]+?)__/g, (_, key) => {
    assert.ok(Object.hasOwn(values, key), "UNKNOWN_CATALOG_BINDING");
    return values[key];
  });
}
