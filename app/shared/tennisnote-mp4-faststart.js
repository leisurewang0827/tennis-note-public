/* MP4 fast-start: 메타데이터만 메모리에 읽고 미디어 payload는 File.slice로 재배치한다. */
(function (root) {
  "use strict";
  const maxMoovBytes = 32 * 1024 * 1024;
  const allowedTopLevel = new Set(["ftyp", "free", "skip", "wide", "mdat", "moov"]);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const fail = () => { throw new Error("personal_journal_mp4_prepare_failed"); };
  const unsafeMarkers = new Set(["iloc", "saio", "senc", "subs", "cmov", "mvex"].map((name) =>
    [...name].reduce((value, character) => ((value << 8) | character.charCodeAt(0)) >>> 0, 0)));
  const typeAt = (view, offset) => String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + offset, 4));
  function readBox(view, position, limit, headerOnly = false) {
    if (position + 8 > limit) fail();
    let size = view.getUint32(position);
    const type = typeAt(view, position + 4);
    let header = 8;
    if (size === 1) {
      if (position + 16 > limit) fail();
      const wide = view.getBigUint64(position + 8);
      if (wide > maxSafe) fail();
      size = Number(wide);
      header = 16;
    }
    // Size zero and fragmented media need additional offset rewriting; never guess.
    if (size < header || (!headerOnly && position + size > limit)) fail();
    return { type, start: position, end: position + size, header, size };
  }
  function children(view, start, end) {
    const result = [];
    for (let position = start; position < end;) {
      if (result.length >= 512) fail();
      const box = readBox(view, position, end);
      result.push(box);
      position = box.end;
    }
    return result;
  }
  function exactlyOne(boxes, type) {
    const found = boxes.filter((box) => box.type === type);
    if (found.length !== 1) fail();
    return found[0];
  }
  function chunkTable(view, stbl, mdat, shift) {
    const boxes = children(view, stbl.start + stbl.header, stbl.end);
    const tables = boxes.filter((box) => box.type === "stco" || box.type === "co64");
    if (tables.length !== 1) fail();
    const table = tables[0];
    const wide = table.type === "co64";
    const stride = wide ? 8 : 4;
    if (table.start + table.header + 8 > table.end || view.getUint8(table.start + table.header) !== 0) fail();
    const count = view.getUint32(table.start + table.header + 4);
    const first = table.start + table.header + 8;
    if (!count || first + count * stride !== table.end) fail();
    for (let index = 0; index < count; index += 1) {
      const position = first + index * stride;
      const original = wide ? view.getBigUint64(position) : BigInt(view.getUint32(position));
      if (original < BigInt(mdat.start + mdat.header) || original >= BigInt(mdat.end)) fail();
      const relocated = original + BigInt(shift);
      if (wide) {
        if (relocated > 0xffffffffffffffffn) fail();
        view.setBigUint64(position, relocated);
      } else {
        if (relocated > 0xffffffffn) fail(); // stco->co64 확대 없이 안전하게 중단한다.
        view.setUint32(position, Number(relocated));
      }
    }
    return boxes;
  }
  function validateTrack(view, track, mdat, shift) {
    const trackBoxes = children(view, track.start + track.header, track.end);
    const mdia = exactlyOne(trackBoxes, "mdia");
    const mdiaBoxes = children(view, mdia.start + mdia.header, mdia.end);
    const hdlr = exactlyOne(mdiaBoxes, "hdlr");
    if (hdlr.start + hdlr.header + 12 > hdlr.end) fail();
    const handler = typeAt(view, hdlr.start + hdlr.header + 8);
    const minf = exactlyOne(mdiaBoxes, "minf");
    const stbl = exactlyOne(children(view, minf.start + minf.header, minf.end), "stbl");
    const stblBoxes = chunkTable(view, stbl, mdat, shift);
    if (stblBoxes.some((box) => ["saio", "senc", "subs"].includes(box.type))) fail();
    const stsd = exactlyOne(stblBoxes, "stsd");
    const data = stsd.start + stsd.header;
    if (data + 16 > stsd.end || view.getUint8(data) !== 0 || view.getUint32(data + 4) !== 1) fail();
    const sample = readBox(view, data + 8, stsd.end);
    if (sample.end !== stsd.end) fail();
    if (handler === "vide" && !["hvc1", "hev1", "avc1", "avc3"].includes(sample.type)) fail();
    if (handler === "soun" && sample.type !== "mp4a") fail();
    if (!["vide", "soun", "meta", "text", "tmcd"].includes(handler)) fail();
    return { handler, codec: sample.type };
  }
  async function inspect(file) {
    if (file.type !== "video/mp4") return { faststart: true, file, codec: "other" };
    if (!Number.isSafeInteger(file.size) || file.size < 24) fail();
    const top = [];
    for (let position = 0; position < file.size;) {
      if (top.length >= 64) fail();
      const bytes = await file.slice(position, Math.min(file.size, position + 16)).arrayBuffer();
      const header = new DataView(bytes);
      const box = readBox(header, 0, Math.min(file.size - position, 16), true);
      if (box.size > file.size - position) fail();
      top.push({ ...box, start: position, end: position + box.size });
      position += box.size;
    }
    if (top[0]?.type !== "ftyp" || top.some((box) => !allowedTopLevel.has(box.type))) fail();
    const moov = exactlyOne(top, "moov");
    const mdat = exactlyOne(top, "mdat");
    if (mdat.end > file.size || moov.end > file.size || top[0].end > file.size) fail();
    if (moov.start < mdat.start) return { faststart: true, file, codec: "mp4" };
    if (moov.end !== file.size || moov.size > maxMoovBytes || moov.size < 16) fail();
    const bytes = new Uint8Array(await file.slice(moov.start, moov.end).arrayBuffer());
    const view = new DataView(bytes.buffer);
    // These structures can carry additional offsets that stco/co64 relocation cannot cover.
    for (let offset = 0; offset <= bytes.length - 4; offset += 1) {
      if (unsafeMarkers.has(view.getUint32(offset))) fail();
    }
    const rootBox = readBox(view, 0, bytes.length);
    if (rootBox.type !== "moov" || rootBox.end !== bytes.length) fail();
    const boxes = children(view, rootBox.header, rootBox.end);
    if (boxes.some((box) => ["mvex", "cmov"].includes(box.type))) fail();
    const tracks = boxes.filter((box) => box.type === "trak");
    if (!tracks.length) fail();
    const codecs = tracks.map((track) => validateTrack(view, track, mdat, bytes.length));
    if (!codecs.some((track) => track.handler === "vide")) fail();
    const output = new root.File([file.slice(0, top[0].end), bytes, file.slice(top[0].end, moov.start)], file.name,
      { type: file.type, lastModified: file.lastModified });
    if (output.size !== file.size) fail();
    return { faststart: false, file: output, codec: codecs.find((track) => track.handler === "vide")?.codec };
  }
  root.TennisNoteMp4Faststart = Object.freeze({ inspect, prepare: async (file) => (await inspect(file)).file });
})(typeof window === "undefined" ? globalThis : window);
