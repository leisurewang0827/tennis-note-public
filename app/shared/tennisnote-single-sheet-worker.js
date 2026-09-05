(function (root) {
  "use strict";
  const LIMITS = Object.freeze({ fileBytes: 5 * 1024 * 1024, entries: 256, entryBytes: 8 * 1024 * 1024, inflatedBytes: 24 * 1024 * 1024, milliseconds: 10000 });
  const fail = code => { throw new Error(code); };
  const signature = (v, offset, expected) => offset >= 0 && offset + 4 <= v.byteLength && v.getUint32(offset, true) === expected;
  const crcTable = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  function crc32(bytes) { let crc = 0xffffffff; for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
  async function boundedZip(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 22 || bytes.length > LIMITS.fileBytes) fail("FILE_SIZE_INVALID");
    const started = Date.now();
    const budget = () => { if (Date.now() - started > LIMITS.milliseconds) fail("PARSING_TIMEOUT"); };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    while (end >= Math.max(0, bytes.length - 65557) && !signature(view, end, 0x06054b50)) end--;
    if (!signature(view, end, 0x06054b50) || end + 22 + view.getUint16(end + 20, true) !== bytes.length) fail("XLSX_REQUIRED");
    const count = view.getUint16(end + 10, true), cdSize = view.getUint32(end + 12, true), cdOffset = view.getUint32(end + 16, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count !== view.getUint16(end + 8, true) || !count || count > LIMITS.entries || cdOffset + cdSize !== end) fail("ZIP_STRUCTURE_INVALID");
    let offset = cdOffset, inflated = 0, declared = 0;
    const names = new Set(), entries = [], ranges = [];
    for (let i = 0; i < count; i++) {
      budget();
      if (offset + 46 > end || !signature(view, offset, 0x02014b50)) fail("ZIP_STRUCTURE_INVALID");
      const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true), crc = view.getUint32(offset + 16, true);
      const packed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true), local = view.getUint32(offset + 42, true);
      if (flags & 1 || ![0, 8].includes(method) || view.getUint16(offset + 34, true) || size > LIMITS.entryBytes || packed > LIMITS.fileBytes || offset + 46 + nameLength + extra + comment > end) fail("ZIP_LIMIT");
      declared += size;
      if (declared > LIMITS.inflatedBytes) fail("ZIP_LIMIT");
      const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
      let name;
      try { name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes); } catch { fail("ZIP_STRUCTURE_INVALID"); }
      if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").includes("..") || names.has(name.toLowerCase())) fail("ZIP_STRUCTURE_INVALID");
      names.add(name.toLowerCase());
      if (local + 30 > cdOffset || !signature(view, local, 0x04034b50) || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) fail("ZIP_STRUCTURE_INVALID");
      const localNameLength = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
      const begin = local + 30 + localNameLength + localExtra, finish = begin + packed;
      if (finish > cdOffset || localNameLength !== nameLength || !nameBytes.every((b, n) => b === bytes[local + 30 + n]) || ranges.some(([s, e]) => local < e && finish > s)) fail("ZIP_STRUCTURE_INVALID");
      ranges.push([local, finish]);
      const chunks = []; let actual = 0;
      if (method === 0) { chunks.push(bytes.slice(begin, finish)); actual = packed; }
      else {
        let stream;
        // Byte-backed stream avoids WebKit Worker Blob I/O failures. Still bounded,
        // streamed decompression; never fall back to synchronous vendor inflation.
        try { stream = new ReadableStream({ start(controller) { controller.enqueue(bytes.slice(begin, finish)); controller.close(); } }).pipeThrough(new DecompressionStream("deflate-raw")); }
        catch { fail("DECOMPRESSION_UNAVAILABLE"); }
        const reader = stream.getReader();
        try {
          while (true) {
            budget(); const part = await reader.read(); if (part.done) break;
            actual += part.value.byteLength;
            if (actual > size || actual > LIMITS.entryBytes || inflated + actual > LIMITS.inflatedBytes) { await reader.cancel(); fail("ZIP_LIMIT"); }
            chunks.push(part.value);
          }
        } finally { reader.releaseLock(); }
      }
      if (actual !== size || inflated + actual > LIMITS.inflatedBytes) fail("ZIP_SIZE_MISMATCH");
      inflated += actual;
      const plain = new Uint8Array(actual); let cursor = 0;
      for (const chunk of chunks) { plain.set(chunk, cursor); cursor += chunk.length; }
      if (crc32(plain) !== crc) fail("ZIP_CRC_MISMATCH");
      entries.push({ name, nameBytes, plain, crc });
      offset += 46 + nameLength + extra + comment;
    }
    if (offset !== end || !names.has("[content_types].xml") || !names.has("xl/workbook.xml")) fail("XLSX_REQUIRED");
    // Repack verified plaintext as STORE: the vendor cannot independently inflate hidden payloads.
    const total = entries.reduce((sum, e) => sum + 76 + 2 * e.nameBytes.length + e.plain.length, 22);
    const result = new Uint8Array(total), out = new DataView(result.buffer); let cursor = 0;
    for (const e of entries) {
      budget(); e.local = cursor;
      out.setUint32(cursor, 0x04034b50, true); out.setUint16(cursor + 4, 20, true); out.setUint16(cursor + 6, 0x800, true);
      out.setUint32(cursor + 14, e.crc, true); out.setUint32(cursor + 18, e.plain.length, true); out.setUint32(cursor + 22, e.plain.length, true); out.setUint16(cursor + 26, e.nameBytes.length, true);
      result.set(e.nameBytes, cursor + 30); result.set(e.plain, cursor + 30 + e.nameBytes.length); cursor += 30 + e.nameBytes.length + e.plain.length;
    }
    const central = cursor;
    for (const e of entries) {
      out.setUint32(cursor, 0x02014b50, true); out.setUint16(cursor + 4, 20, true); out.setUint16(cursor + 6, 20, true); out.setUint16(cursor + 8, 0x800, true);
      out.setUint32(cursor + 16, e.crc, true); out.setUint32(cursor + 20, e.plain.length, true); out.setUint32(cursor + 24, e.plain.length, true); out.setUint16(cursor + 28, e.nameBytes.length, true); out.setUint32(cursor + 42, e.local, true);
      result.set(e.nameBytes, cursor + 46); cursor += 46 + e.nameBytes.length;
    }
    out.setUint32(cursor, 0x06054b50, true); out.setUint16(cursor + 8, count, true); out.setUint16(cursor + 10, count, true); out.setUint32(cursor + 12, cursor - central, true); out.setUint32(cursor + 16, central, true);
    return { bytes: result, inflatedBytes: inflated, entries: count };
  }
  if (typeof module === "object" && module.exports) module.exports = { boundedZip, LIMITS, crc32 };
  if (typeof importScripts !== "function") return;
  importScripts("./vendor/xlsx.full.min.js", "./tennisnote-single-sheet-import.js");
  let used = false;
  root.onmessage = async event => {
    if (used) return;
    used = true;
    const { id, bytes, snapshot, now, serverProtocol } = event.data || {};
    let stage = "ZIP_VALIDATION";
    try {
      const original = new Uint8Array(bytes);
      const normalized = await boundedZip(original);
      stage = "FILE_HASH";
      const digest = await crypto.subtle.digest("SHA-256", original);
      const fileHash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
      stage = "WORKBOOK_PARSE";
      const workbook = XLSX.read(normalized.bytes, { type: "array", cellFormula: true, cellDates: false, cellStyles: true, bookFiles: true, bookVBA: true });
      const api = root.TennisNoteSingleSheetImport;
      stage = "ROW_PARSE";
      const parsed = await api.parseWorkbook(workbook, fileHash);
      if (serverProtocol === "local-synthetic/1" && ["localhost", "127.0.0.1", "[::1]"].includes(root.location.hostname) && !parsed.errors.length) {
        root.postMessage({ id, type: "ephemeral-units", payload: await api.serverUnits(parsed) });
        return;
      }
      if (serverProtocol === "scoped-postgrest-import/2"
        && ["https://tennisnote-admin-dev.pages.dev", "https://tennisnote-admin.pages.dev"].includes(root.location.origin)
        && !parsed.errors.length) {
        const payload = await api.serverUnits(parsed);
        root.postMessage({ id, type: "remote-preview-units", payload: {
          protocol: serverProtocol,
          fileHash: payload.fileHash,
          units: payload.units.map(entry => ({ rowNumbers: entry.rowNumbers, operationKey: entry.operationKey, unit: entry.unit })),
          held: payload.held,
        } });
        return;
      }
      // WeakMap parse/plan identity stays in this Worker. Only safe presentation is cloned.
      if (parsed.errors.length || !snapshot?.context) {
        root.postMessage({ id, type: "result", result: { canApply: false, errors: parsed.errors, snapshotErrors: snapshot?.errors || ["SNAPSHOT_INCOMPLETE"],
          rows: parsed.rows.map(r => ({ rowNumber: r.rowNumber, status: "HOLD", reasons: r.reasons })), plans: [], summary: null } });
      } else {
        stage = "PREVIEW_PLAN";
        const preview = await api.buildPreview(parsed, snapshot.context, now);
        if (preview.errors.length) {
          root.postMessage({ id, type: "result", result: { canApply: false, errors: preview.errors, snapshotErrors: [],
            rows: parsed.rows.map(r => ({ rowNumber: r.rowNumber, status: "HOLD", reasons: r.reasons })), plans: [], summary: null } });
          return;
        }
        root.postMessage({ id, type: "result", result: { canApply: false, errors: preview.errors, snapshotErrors: [],
          rows: preview.rows.map(r => ({ rowNumber: r.rowNumber, status: r.status, reasons: r.reasons, plannedLessons: r.plannedLessons })), plans: preview.plans.map(p => ({ date: p.date, time: p.time, durationMinutes: p.durationMinutes, participantRows: p.participantRows })), summary: api.safeSummary(preview) } });
      }
    } catch (error) {
      const allowed = /^(FILE_SIZE_INVALID|XLSX_REQUIRED|ZIP_STRUCTURE_INVALID|ZIP_LIMIT|ZIP_SIZE_MISMATCH|ZIP_CRC_MISMATCH|PARSING_TIMEOUT|DECOMPRESSION_UNAVAILABLE)$/;
      root.postMessage({ id, type: "error", code: allowed.test(error.message) ? error.message : "XLSX_PARSE_FAILED", stage });
    } finally { root.close(); }
  };
})(globalThis);
