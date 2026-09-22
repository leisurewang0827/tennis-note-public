/* 개인운동 서버 저장과 private 미디어. 수업/회원권/피드백 저장 경로와 분리한다. */
(function (root) {
  "use strict";
  const bucket = "tennisnote-journal-media";
  const types = { "개인연습": "solo_practice", "랠리 및 게임": "rally_game", "기타": "other" };
  const labels = { solo_practice: "개인연습", rally_game: "랠리 및 게임", other: "기타" };
  const mimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"]);
  const key = () => root.crypto.randomUUID();
  const client = () => {
    const value = root.TennisNoteDataClient;
    if (!value?.getSession?.()?.access_token || !value.rpc) throw new Error("personal_journal_login_required");
    return value;
  };
  const call = (action, payload = {}) => client().rpc("tn_personal_journal", { target_action: action, payload });
  function errorMessage(error, action = "save") {
    const message = [error?.code, error?.message, error?.status, error?.statusCode].filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "_");
    if (/stale_revision|existing_revision/.test(message)) return "다른 화면에서 변경된 기록입니다. 다시 불러온 뒤 수정해 주세요. 입력 내용은 유지됩니다.";
    if (/invalid_media/.test(message)) return "사진은 JPEG·PNG·WEBP, 영상은 MP4·MOV·WebM, 파일당 100MB 이하만 첨부할 수 있습니다.";
    if (/owner_required|not_owned|auth_profile_mapping_ambiguous|42501|403/.test(message)) return "개인운동 기록의 접근 권한을 확인하지 못했습니다. 본인 기록만 이용할 수 있습니다. 기존 기록과 입력은 유지됩니다. 문제가 계속되면 관리자에게 문의해 주세요.";
    if (/login_required/.test(message)) return "로그인이 필요합니다. 입력 내용은 유지됩니다.";
    if (action === "list") return "개인운동 기록을 불러오지 못했습니다. 기존 기록과 입력은 유지됩니다. 연결을 확인한 뒤 다시 열어 주세요.";
    return "서버 저장을 완료하지 못했습니다. 입력은 유지됩니다. 연결을 확인한 뒤 다시 저장해 주세요.";
  }
  function validateFiles(files) {
    for (const file of files) {
      if (!mimeTypes.has(file.type) || file.size < 1 || file.size > 104857600) throw new Error("personal_journal_invalid_media");
    }
  }
  async function digest(file) {
    const bytes = await root.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  function body(log) {
    return { memo: log.memo || "", next: log.next || "", feedbackQuestion: log.feedbackQuestion || "" };
  }
  async function save(log, files = [], checkpoint = () => {}) {
    validateFiles(files);
    if (!String(log.memo || "").trim()) throw new Error("personal_journal_invalid_content");
    log.personalClientKey ||= key();
    // 응답을 잃은 요청은 동일 payload/key로 먼저 확인한다. 변경된 draft를 덮어쓰지 않는다.
    const desired = JSON.stringify({ entryDate: log.journalDate, practiceType: types[log.type] || "other", body: body(log) });
    if (!log.personalPendingSave) {
      log.personalPendingSave = { operationKey: key(), clientKey: log.personalClientKey,
        journalId: log.serverJournalId || null, expectedOwnerId: log.personalOwnerId,
        expectedRevision: log.serverRevision || null, ...JSON.parse(desired) };
      checkpoint(log);
    }
    const pending = log.personalPendingSave;
    const result = await call("save", pending);
    log.serverJournalId = result.journalId;
    log.serverRevision = result.revision;
    delete log.personalPendingSave;
    checkpoint(log);
    const pendingBody = JSON.stringify({ entryDate: pending.entryDate, practiceType: pending.practiceType, body: pending.body });
    if (pendingBody !== desired) return save(log, files, checkpoint);
    for (const file of files) {
      const sha256 = await digest(file);
      const reservation = await call("reserve_media", {
        operationKey: `media:${log.serverJournalId}:${sha256}`, journalId: log.serverJournalId,
        sha256, byteSize: file.size, mimeType: file.type,
      });
      if (reservation.state !== "ready") {
        try { await client().uploadObject(bucket, reservation.storagePath, file); }
        catch (error) {
          // 업로드 응답 손실도 서버의 exact metadata 확인으로만 성공 판정한다.
          // 오류 문자열에 URL/개인정보를 넣지 않는다.
          try {
            await call("finish_media", { operationKey: `ready:${reservation.mediaId}`, journalId: log.serverJournalId, mediaId: reservation.mediaId });
            continue;
          } catch { throw new Error("personal_journal_upload_incomplete"); }
        }
        await call("finish_media", { operationKey: `ready:${reservation.mediaId}`, journalId: log.serverJournalId, mediaId: reservation.mediaId });
      }
    }
    return result;
  }
  async function remove(log) {
    if (!log.serverJournalId || !log.serverRevision) throw new Error("personal_journal_not_owned");
    const result = await call("delete", { operationKey: `delete:${log.serverJournalId}:${log.serverRevision}`,
      journalId: log.serverJournalId, expectedRevision: log.serverRevision });
    const cleanupPending = await cleanup();
    return { ...result, cleanupPending };
  }
  async function cleanup(snapshot = null) {
    const data = snapshot || await call("list");
    let remaining = 0;
    for (const media of data.media || []) {
      if (media.upload_state !== "delete_pending") continue;
      try {
        await client().deleteObject(bucket, media.storage_path);
        await call("ack_media_deleted", { operationKey: `removed:${media.id}`, journalId: media.journal_entry_id, mediaId: media.id });
      } catch { remaining += 1; } // 삭제 대기 기록을 보존하고 다음 동기화에서 재시도한다.
    }
    return remaining;
  }
  async function load() {
    const data = await call("list");
    if (!Array.isArray(data?.entries) || !Array.isArray(data?.media)) throw new Error("personal_journal_invalid_list");
    const cleanupPending = await cleanup(data);
    const logs = [];
    const tombstones = new Set();
    for (const row of data.entries || []) {
      if (row.deleted_at) { tombstones.add(row.id); continue; }
      let payload;
      try { payload = JSON.parse(row.body || "{}"); } catch { payload = { memo: row.body || "" }; }
      const mediaItems = [];
      let mediaPending = 0;
      for (const media of (data.media || []).filter((m) => m.journal_entry_id === row.id)) {
        if (media.upload_state === "reserved") { mediaPending += 1; continue; }
        if (media.upload_state && media.upload_state !== "ready") continue;
        const item = { name: media.media_type === "video" ? "운동 영상" : "운동 사진", type: media.mime_type || (media.media_type === "video" ? "video/mp4" : "image/jpeg"),
          serverMediaId: media.id, storagePath: media.storage_path, url: "" };
        try { item.url = URL.createObjectURL(await client().downloadObject(bucket, media.storage_path)); }
        catch { item.error = "첨부를 불러오지 못했습니다. 다시 열어 주세요."; }
        mediaItems.push(item);
      }
      logs.push({ id: row.personal_client_key || `server-practice-${row.id}`, personalClientKey: row.personal_client_key,
        serverJournalId: row.id, serverRevision: row.revision, personalOwnerVerified: true,
        journalDate: row.entry_date, date: row.entry_date, type: labels[row.practice_type] || "기타",
        memo: payload.memo || "", next: payload.next || "", feedbackQuestion: payload.feedbackQuestion || "",
        feedbackStatus: "개인 기록", coachFeedback: "", mediaItems, mediaNames: mediaItems.map((m) => m.name),
        mediaPending, submittedAt: row.created_at });
    }
    return { logs, tombstones, cleanupPending };
  }
  function release(logs) {
    for (const log of logs || []) for (const media of log.mediaItems || []) {
      if (media.serverMediaId && String(media.url).startsWith("blob:")) URL.revokeObjectURL(media.url);
    }
  }
  root.TennisNotePersonalJournal = Object.freeze({ key, save, remove, load, cleanup, release, errorMessage, validateFiles });
})(typeof window === "undefined" ? globalThis : window);
