// Read-only local assembly. Existing STOP statements remain in both SQL transactions.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assembleLinkedRoutes } from "./first-issue-linked-routes.mjs";

const sha256 = x => createHash("sha256").update(x).digest("hex");
const need = (v, code) => { if (!v) throw Error(code); };
const locked = (name, digest) => {
  const file = readFileSync(new URL(name, import.meta.url));
  need(sha256(file) === digest, "R4_CATALOG_INPUT_DRIFT:" + name);
  return file.toString("utf8");
};
const pinSha = "09d354721813053a4c63f4d7a78ca35c43d2a12771863ca5a3615f02cba1aaf8";
const receiptSha = "3d4aa547201843ae3d2754411a0ec269258aee691ef3d7a8bc85d9d7b374cd6f";
const querySha = "6b9330ac75c1ecf36a4b88bc04ab1a37a485261f3773cd5673c53031a1119bd7";
const advisory = "select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tennisnote-r4-first-issue-ddl-v1',0));\n";
const marker = "__ASSEMBLY_PHASE__";
const stop = /^do \$(review|stop|external)\$ begin raise exception 'r4_[a-z_]+'; end \$\1\$;$/gm;
const off = `do $r4_remain_off$ begin
  if not exists(select from private.tn_r4_first_issue_control where singleton and not enabled)
    or exists(select from private.tn_r4_first_issue_scope where enabled)
  then raise exception 'r4_db_transition_not_off'; end if;
end $r4_remain_off$;`;

export function buildPinnedReviewSql(checkout, options) {
  const base = assembleLinkedRoutes(checkout, options);
  const read = locked("prod-r4-storage-preimage-delta-readonly.sql", querySha);
  const receipt = JSON.parse(locked("prod-r4-storage-preimage-delta.json", receiptSha));
  const guard = locked("prod-r4-storage-transition-pin.sql", pinSha);
  const target = base.routes["db-install-off"].target;
  need(receipt.kind === "R4_PRODUCTION_STORAGE_CATALOG_READ_ONLY" && receipt.querySha256 === querySha &&
    receipt.targetFingerprint === target && receipt.readOnly && receipt.issueBackupAbsent &&
    receipt.lessonCanaryAbsent && receipt.issueFenceAbsent && receipt.storageFenceAbsent &&
    receipt.schedulerKnown && receipt.schedulerAnchorOnce && guard.includes(receipt.schedulerExpectedPostSha),
  "R4_CATALOG_RECEIPT_MISMATCH");

  const readExpression = s => s.split("encode(sha256(convert_to(jsonb_build_object(")[1]?.split(")::text,'UTF8')),'hex')")[0];
  const normalized = s => s.replace(/\s+/g, "").replace(/and\(phase='baseline'ort\.tgnamenotin\('zz_tn_r4_canary_row_fence','zz_tn_r4_canary_truncate_fence'\)\)/, "");
  const original = readExpression(read), selected = readExpression(guard);
  need(original && selected && normalized(original) === normalized(selected), "R4_CATALOG_HASH_FORMULA_DRIFT");
  const pinPairs = [...guard.matchAll(/\('(tn_[a-z0-9_]+)','([a-f0-9]{64})'\)/g)].map(m => [m[1], m[2]]);
  need(receipt.storage.length === 5 && pinPairs.length === 5 && new Set(pinPairs.map(([n]) => n)).size === 5 &&
    receipt.storage.every((r, i) => r.eligible === true && r.required_columns_present === true &&
      r.trigger_name_conflicts === 0 && r.name === pinPairs[i][0] && r.metadata_sha256 === pinPairs[i][1]),
  "R4_STORAGE_BASELINE_MISMATCH");
  need(guard.split(marker).length === 2, "R4_STORAGE_PHASE_MARKER_DRIFT");
  const fenceBodies = [...base.apply.sql.replaceAll("\r\n", "\n").matchAll(
    /create function private\.tn_r4_canary_fence_lesson_storage\(\) returns trigger\nlanguage plpgsql security definer set search_path=pg_catalog as \$fn\$([\s\S]*?)\$fn\$;/g)];
  need(fenceBodies.length === 1 && guard.includes("'" + sha256(fenceBodies[0][1]) + "'"),
    "R4_STORAGE_FENCE_BODY_PIN_DRIFT");

  const addGuards = (sql, from, to, stopCount) => {
    const insertAt = sql.indexOf(advisory) + advisory.length;
    const end = sql.lastIndexOf("\ncommit;\n");
    need(sql.split(advisory).length === 2 && end === sql.length - "\ncommit;\n".length &&
      sql.match(stop)?.length === stopCount, "R4_SQL_BOUNDARY_DRIFT");
    const pre = `set local search_path=pg_catalog;\n${guard.replace(marker, from)}\n`;
    const post = `\n${guard.replace(marker, to)}\n${off}`;
    const withPins = sql.slice(0, insertAt) + pre + sql.slice(insertAt, end) + post + sql.slice(end);
    need(JSON.stringify(withPins.match(stop)) === JSON.stringify(sql.match(stop)) && !withPins.includes(marker),
      "R4_SQL_STOPS_CHANGED");
    return Object.freeze({ sql: withPins, sha256: sha256(withPins), stops: stopCount });
  };
  const install = addGuards(base.apply.sql, "baseline", "installed", 5);
  const restore = addGuards(base.unwind.sql, "installed", "baseline", 4);
  return Object.freeze({ kind: "REVIEW_ONLY", executionAllowed: false, target, base: base.linked, receiptSha,
    install, restore, retained: ["control-off", "disabled-scope", "operation-and-issuance-history"] });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) throw Error("Usage: node r4-prod-catalog-pinned-db-packet.mjs <candidate-checkout>");
  const r = buildPinnedReviewSql(process.argv[2]);
  console.log(JSON.stringify({ kind: r.kind, executionAllowed: r.executionAllowed, sourcePacket: r.base,
    receiptSha: r.receiptSha, installSha: r.install.sha256, restoreSha: r.restore.sha256,
    preservedStops: r.install.stops + r.restore.stops }));
}
