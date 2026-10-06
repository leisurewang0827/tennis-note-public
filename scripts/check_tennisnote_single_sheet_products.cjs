/* Synthetic bytes, memory-only mock reads. No DB, credentials, or output files. */
"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { webcrypto, createHash } = require("node:crypto");
const api = require("../app/shared/tennisnote-single-sheet-import.js");
const XLSX = require("../app/shared/vendor/xlsx.full.min.js");
const zip = require("./check_tennisnote_single_sheet_preview.cjs");
const { boundedZip } = require("../app/shared/tennisnote-single-sheet-worker.js");
const ROOT = path.resolve(__dirname, "..");
const snapshot = (count = 37) => ({ complete: true, branchId: "synthetic-branch", products: Array.from({ length: count }, (_, i) => ({ id: `p${i}`, branch_id: "synthetic-branch", is_active: true, product_kind: i % 2 ? "group" : "regular", name: `합성 상품 ${String(i + 1).padStart(3, "0")} 정규 수업` })) });
function rewrite(bytes, part, fn) {
  const z = XLSX.CFB.read(bytes, { type: "array" });
  const e = XLSX.CFB.find(z, `Root Entry/${part}`);
  XLSX.CFB.utils.cfb_add(z, `Root Entry/${part}`, new TextEncoder().encode(fn(new TextDecoder().decode(e.content))));
  return new Uint8Array(XLSX.CFB.write(z, { type: "array", fileType: "zip" }));
}
async function run() {
  let assertions = 0;
  const check = (v, code) => { assertions++; if (!v) throw Error(code); };
  const rejects = (fn, code) => { let got = ""; try { fn(); } catch (e) { got = e.message; } check(got === code, code); };
  const s = snapshot(), bytes = api.buildProductTemplateBytes(XLSX, s);
  const unpacked = await boundedZip(bytes);
  const wb = XLSX.read(unpacked.bytes, { type: "array", bookFiles: true, cellStyles: true });
  check(wb.SheetNames.join("|") === "회원등록|상품목록", "EXACT_TWO_SHEETS");
  check(wb.Workbook.Names[0].Ref === "'상품목록'!$A$2:$A$38", "EXACT_INTERNAL_RANGE");
  const inputXml = new TextDecoder().decode(wb.files["xl/worksheets/sheet1.xml"].content);
  check(inputXml.indexOf("<dataValidations") > inputXml.indexOf("</sheetData>") && inputXml.indexOf("<dataValidations") < inputXml.indexOf("<ignoredErrors"), "OOXML_CHILD_ORDER");
  check(s.products.map(p => p.name).join(",").length > 255, "LONG_LIST_NOT_INLINE");
  check(s.products.every((p, i) => wb.Sheets["상품목록"][`A${i + 2}`].v === p.name), "ALL_PRODUCTS_UNCHANGED");
  check((await api.readFile(bytes, XLSX)).errors.join() === "EMPTY_DATA", "ACTUAL_BLANK_XLSX_REIMPORT");
  // Populate one synthetic row in the actual ZIP without stripping validation.
  const fixture = XLSX.read(zip.workbookBytes(), { type: "array" }).Sheets[api.SHEET];
  fixture.D2.v = s.products[0].name;
  const one = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(one, fixture, api.SHEET);
  const raw = XLSX.read(XLSX.write(one, { type: "array", bookType: "xlsx" }), { type: "array", bookFiles: true });
  const rowXml = new TextDecoder().decode(raw.files["xl/worksheets/sheet1.xml"].content).match(/<row r="2"[^>]*>[\s\S]*?<\/row>/)[0];
  const populated = rewrite(bytes, "xl/worksheets/sheet1.xml", xml => xml.replace(/<row r="2"[^>]*>[\s\S]*?<\/row>/, rowXml));
  const parsed = await api.readFile(populated, XLSX);
  check(parsed.errors.length === 0 && parsed.rows.length === 1 && parsed.rows[0].status === "PARSED", "POPULATED_V2_REIMPORT");
  const payload = await api.serverUnits(parsed);
  check(payload.units[0].unit.rows[0].product === s.products[0].name && payload.units[0].unit.rows[0].used === 0, "EXACT_PRODUCT_SERVER_PAYLOAD");
  check(!JSON.stringify(payload).includes("TN_ProductOptions") && !JSON.stringify(payload).includes("상품목록"), "CATALOG_NOT_SERVER_AUTHORITY");
  const repeat = await api.readFile(populated, XLSX);
  check(repeat.rows[0].operationKey === parsed.rows[0].operationKey, "V2_REPLAY_KEY_STABLE");
  const parts = ["xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"];
  let prefixed = populated;
  for (const part of parts) prefixed = rewrite(prefixed, part, xml => xml.replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(/<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g, '<$1x:$2'));
  const prefixResult = await api.readFile(prefixed, XLSX);
  check(prefixResult.errors.length === 0 && prefixResult.rows.length === 1, "X_PREFIX_POPULATED_ACCEPTED");
  check((await api.serverUnits(prefixResult)).units[0].unit.rows[0].product === payload.units[0].unit.rows[0].product, "X_PREFIX_PRODUCT_PRESERVED");
  for (const [part, mutate] of [
    [parts[0], x => x.replace('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns:x="https://invalid.example/forged"')],
    [parts[0], x => x.replace('<x:definedName name=', '<x:definedName xmlns:x="https://invalid.example/forged" name=')],
    [parts[0], x => x.replace('<x:definedName name=', '<x:definedName xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name=')],
    [parts[0], x => x.replace('<x:definedName name=', '<x:definedName xmlns:y="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name=')],
    [parts[0], x => x.replace('<x:definedName name=', '<x:definedName xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name=')],
    [parts[0], x => x.replace('<x:definedName name=', '<definedName name=').replace('</x:definedName>', '</definedName>')],
    [parts[0], x => x.replace('$A$38', '$A$999')],
    [parts[1], x => x.replace('sqref="D2:D501"', 'sqref="C2:C501"')],
    [parts[1], x => x.replace('</x:worksheet>', '<x:extLst/></x:worksheet>')],
    ['xl/_rels/workbook.xml.rels', x => x.replace('Target="worksheets/sheet2.xml"', 'TargetMode="External" Target="https://invalid.example/sheet2.xml"')],
  ]) {
    const changed = rewrite(prefixed, part, mutate);
    check(!Buffer.from(changed).equals(Buffer.from(prefixed)), "NAMESPACE_ATTACK_CHANGED_BYTES");
    const rejected = await api.readFile(changed, XLSX).catch(() => ({ errors: ["REJECTED"] }));
    check(rejected.errors.length > 0 && rejected.rows?.length !== 1, "NAMESPACE_ATTACK_BLOCKED");
  }
  for (const mutate of [p => p.products.push({ ...p.products[0], id: "other" }), p => p.products.push({ ...p.products[0], id: "other", name: ` ${p.products[0].name} ` })]) {
    const p = snapshot(); mutate(p); rejects(() => api.buildProductTemplateBytes(XLSX, p), "TEMPLATE_PRODUCTS_AMBIGUOUS");
  }
  for (const mutate of [p => p.products[0].is_active = false, p => p.products[0].branch_id = "other", p => p.products[0].name = "=formula", p => p.products[0].name = "합성\u200b", p => p.products[0].name = "x".repeat(161), p => p.products[0].name = "<bad>", p => p.products.push(p.products[0])]) {
    const p = snapshot(); mutate(p); rejects(() => api.buildProductTemplateBytes(XLSX, p), "TEMPLATE_PRODUCTS_INVALID");
  }
  for (const p of [undefined, {}, { ...snapshot(), complete: false }, snapshot(0), snapshot(501)]) rejects(() => api.buildProductTemplateBytes(XLSX, p), "TEMPLATE_PRODUCTS_REQUIRED");
  for (const [part, mutate] of [
    ["xl/workbook.xml", x => x.replace('name="TN_ProductOptions"', 'name="TN_ProductOptions" hidden="1"')],
    ["xl/workbook.xml", x => x.replace("$A$38", "$A$999")],
    ["xl/workbook.xml", x => x.replace("&apos;상품목록&apos;!$A$2:$A$38", "INDIRECT(&quot;A1&quot;)")],
    ["xl/workbook.xml", x => x.replace('<sheet name="상품목록"', '<sheet state="hidden" name="상품목록"')],
    ["xl/worksheets/sheet1.xml", x => x.replace('sqref="D2:D501"', 'sqref="C2:C501"')],
    ["xl/worksheets/sheet1.xml", x => x.replace("<formula1>TN_ProductOptions</formula1>", "<formula1>OTHER</formula1>")],
    ["xl/worksheets/sheet1.xml", x => x.replace('<dataValidations count="1">', '<dataValidations count="2">')],
    ["xl/worksheets/sheet1.xml", x => x.replace('showErrorMessage="1"', 'showErrorMessage="0"')],
    ["xl/worksheets/sheet1.xml", x => x.replace("</worksheet>", '<extLst><unsafe/></extLst></worksheet>')],
    ["xl/worksheets/sheet2.xml", x => x.replace('r="A2"', 'r="B2"')],
    ["xl/worksheets/sheet2.xml", x => x.replace(s.products[1].name, s.products[0].name)],
    ["xl/worksheets/sheet2.xml", x => x.replace('r="A2" t="str">', 'r="A2" t="str"><f>1+1</f>')],
    ["xl/worksheets/sheet2.xml", x => x.replace("</worksheet>", '<hyperlinks><hyperlink ref="A2" location="external"/></hyperlinks></worksheet>')],
    ["xl/_rels/workbook.xml.rels", x => x.replace('Target="worksheets/sheet2.xml"', 'TargetMode="External" Target="https://invalid.example/sheet2.xml"')],
  ]) {
    const changed = rewrite(populated, part, mutate);
    check(!Buffer.from(changed).equals(Buffer.from(populated)), "NEGATIVE_FIXTURE_CHANGED_BYTES");
    const rejected = await api.readFile(changed, XLSX).catch(() => ({ errors: ["REJECTED"] }));
    check(rejected.errors.length > 0 && rejected.rows?.length !== 1, "V2_UNSAFE_BLOCKED");
  }
  // Direct object contamination must also fail; no raw package proof fallback.
  for (const mutate of [w => delete w.files, w => w.Sheets["商品"] = {}, w => w.Workbook.Names.push({ Name: "other", Ref: "A1" }), w => w.Sheets["상품목록"]["!rows"] = [{ hidden: true }]]) {
    const w = XLSX.read(populated, { type: "array", bookFiles: true, cellStyles: true }); mutate(w);
    check((await api.parseWorkbook(w, "a".repeat(64))).errors.length > 0, "STRUCTURE_CONTAMINATION_BLOCKED");
  }
  const ref = "syntheticprojectref", fingerprint = createHash("sha256").update(ref).digest("hex");
  const config = { environment: "development", projectFingerprint: fingerprint, supabaseUrl: `https://${ref}.supabase.co`, singleSheetImportMode: "preview" };
  const context = vm.createContext({ module: { exports: {} }, exports: {}, location: { origin: "https://tennisnote-admin-dev.pages.dev", hostname: "tennisnote-admin-dev.pages.dev" }, crypto: webcrypto, TextEncoder, atob: v => Buffer.from(v, "base64").toString("binary"), Date, Uint8Array, JSON });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "app/shared/tennisnote-single-sheet-transport.js"), "utf8"), context);
  let branch = "11111111-1111-4111-8111-111111111111", reads = 0, writes = 0, mode = "normal";
  const products = snapshot(137).products.map(p => ({ ...p, branch_id: branch }));
  const client = { loadConfig: () => config, getSession: () => ({ access_token: `x.${Buffer.from(JSON.stringify({ role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.x` }), rpc: async () => { writes++; throw Error("UNEXPECTED_RPC"); }, selectRows: async (table, options) => {
    reads++; check(table === "tn_membership_products" && options.select === "id,branch_id,name,is_active,product_kind" && options.filters.branch_id === branch && options.filters.is_active === true && options.order === "id.asc", "SCOPED_READ_ONLY");
    if (mode === "drift") branch = "22222222-2222-4222-8222-222222222222";
    if (mode === "bad") return null;
    return products.slice(options.offset, options.offset + options.limit);
  } };
  const transport = await context.module.exports.create({ client, getBranchId: () => branch, canOpen: () => true });
  const catalog = await transport.templateProducts();
  check(catalog.complete && catalog.products.length === 137 && reads === 2 && writes === 0, "PAGINATED_PRODUCTS_RPC_ZERO");
  check(catalog.products.every((p, i) => p.name === products[i].name && p.product_kind === products[i].product_kind), "REGULAR_GROUP_EXACT_PRESERVED");
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/excel-product-dropdown-source-manifest.json"), "utf8"));
  check(contract.allowedProductKinds.join("|") === "regular|group", "SERVER_KIND_GATE_PARITY");
  for (const entry of contract.files) {
    let text = fs.readFileSync(path.join(ROOT, entry.publicPath), "utf8").replace(/\r\n/g, "\n");
    // Keep the original dropdown blob proof after exact, separately-authorized
    // refresh/retry hunks. Never accept arbitrary edits or replace the old hash.
    const isolation = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/production-excel-refresh-source.json"), "utf8"));
    const patch = isolation.products.find(p => p.path === entry.publicPath);
    if (patch) {
      check(createHash("sha256").update(text).digest("hex") === patch.candidateSha256, "REFRESH_CANDIDATE_EXACT");
      for (const h of [...patch.hunks].reverse()) {
        check(text.split(h.after).length === 2, "REFRESH_INVERSE_HUNK_EXACT");
        text = text.replace(h.after, () => h.before);
      }
      check(createHash("sha256").update(text).digest("hex") === patch.baseSha256, "REFRESH_PREIMAGE_EXACT");
    }
    const source = Buffer.from(text);
    const blob = createHash("sha1").update(`blob ${source.length}\0`).update(source).digest("hex");
    check(blob === entry.gitBlob, "PRIVATE_PUBLIC_PRODUCT_BLOB_PARITY");
  }
  const supported = products.splice(0);
  const excluded = Array.from({ length: 5 }, (_, i) => ({ ...supported[0], id: `excluded-${i}`, name: `합성 정규 표기 ${i}`, product_kind: i < 4 ? "coupon" : "one_day" }));
  products.push(...excluded, ...supported.slice(0, 32));
  const mixed = await transport.templateProducts();
  check(mixed.products.length === 32 && mixed.products.every((p, i) => p.id === supported[i].id), "COUPON_FOUR_ONEDAY_ONE_EXCLUDED");
  check(api.productNames(mixed).length === 32, "FILTERED_SNAPSHOT_VALID");
  products.splice(0, products.length, ...excluded);
  const empty = await transport.templateProducts();
  rejects(() => api.buildProductTemplateBytes(XLSX, empty), "TEMPLATE_PRODUCTS_REQUIRED");
  products.push({ ...excluded[0] });
  await transport.templateProducts().then(() => check(false, "EXCLUDED_DUP_NOT_REJECTED"), e => check(e.message === "TEMPLATE_PRODUCTS_INVALID", "EXCLUDED_DUP_FAIL_CLOSED"));
  products.splice(0, products.length, { ...excluded[0], branch_id: "other" });
  await transport.templateProducts().then(() => check(false, "EXCLUDED_SCOPE_NOT_REJECTED"), e => check(e.message === "TEMPLATE_PRODUCTS_INVALID", "EXCLUDED_SCOPE_FAIL_CLOSED"));
  products.splice(0, products.length, { ...supported[0], product_kind: null });
  await transport.templateProducts().then(() => check(false, "MISSING_KIND_NOT_REJECTED"), e => check(e.message === "TEMPLATE_PRODUCTS_INVALID", "MISSING_KIND_FAIL_CLOSED"));
  products.splice(0, products.length, ...Array.from({ length: 501 }, (_, i) => ({ ...excluded[0], id: `excluded-${i}` })));
  await transport.templateProducts().then(() => check(false, "RAW_LIMIT_NOT_REJECTED"), e => check(e.message === "TEMPLATE_PRODUCTS_LIMIT", "EXCLUDED_RAW_LIMIT_FAIL_CLOSED"));
  products.splice(0, products.length, ...supported);
  mode = "bad"; await transport.templateProducts().then(() => check(false, "BAD_PAGE_NOT_REJECTED"), e => check(e.message === "TEMPLATE_PRODUCTS_INVALID", "BAD_PAGE_FAIL_CLOSED"));
  mode = "drift"; await transport.templateProducts().then(() => check(false, "DRIFT_NOT_REJECTED"), e => check(e.message === "TARGET_OR_REVISION_MISMATCH", "BRANCH_DRIFT_FAIL_CLOSED"));
  const before = reads; await transport.templateProducts().catch(() => {}); check(reads === before && writes === 0, "STALE_SCOPE_NO_READ_OR_WRITE");
  return assertions;
}
if (require.main === module) run().then(n => process.stdout.write(`PASS product dropdown ${n} assertions; DB=0 network=0 files=0\n`)).catch(e => { process.stderr.write(`FAIL product dropdown ${/^[A-Z0-9_]+$/.test(e.message) ? e.message : e.name}\n`); process.exitCode = 1; });
module.exports = { run, snapshot, rewrite };
