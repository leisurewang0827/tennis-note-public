"use strict";
// Explicit reviewed current owner stage; historical pins/goldens stay immutable.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const raw = fs.readFileSync(path.join(__dirname, "../fixtures/r3-coach-init-current-parity.json"), "utf8");
assert.equal(hash(raw), "9c67543cb633af734aaaca211857e36bc253d77957233eaac9bde1f176562e1c", "coach current contract drift");
const contract = JSON.parse(raw);
assert.equal(contract.contract, "r3-coach-init-owner-current/3");
assert.equal(contract.canonicalization, "UTF8-LF");
assert.equal(contract.files.length, 7);
assert.equal(new Set(contract.files.map(row => row.side + "/" + row.path)).size, 7);
function restore(file, text, side = "public") {
  assert(["public", "private"].includes(side), "coach current side unknown");
  const row = contract.files.find(item => item.side === side && item.path === file);
  if (!row || text === null) return text;
  text = text.replace(/\r\n/g, "\n");
  if (hash(text) === row.beforeSha256) return text;
  assert.equal(hash(text), row.afterSha256, "coach current candidate drift: " + file);
  for (const hunk of [...row.hunks].reverse()) {
    assert(hunk.before && hunk.after && text.split(hunk.after).length === 2, "coach current unique hunk drift: " + file);
    text = text.replace(hunk.after, () => hunk.before);
  }
  assert.equal(hash(text), row.beforeSha256, "coach current baseline drift: " + file);
  return text;
}
function rows(side) { return contract.files.filter(row => row.side === side); }
module.exports = { contract, hash, restore, rows };
