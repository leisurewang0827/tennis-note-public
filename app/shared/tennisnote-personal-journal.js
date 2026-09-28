/* 개인운동 서버 저장과 private 미디어. 수업/회원권/피드백 저장 경로와 분리한다. */
(function (root) {
  "use strict";
  const bucket = "tennisnote-journal-media";
  const types = { "개인연습": "solo_practice", "랠리 및 게임": "rally_game", "기타": "other" };
  const labels = { solo_practice: "개인연습", rally_game: "랠리 및 게임", other: "기타" };
  const mimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"]);
  const imageMaxBytes = 100 * 1024 * 1024;
  const videoMaxBytes = 1024 * 1024 * 1024;
  const key = () => root.crypto.randomUUID();
  const fileSelections = new WeakMap();
  const completedMedia = new WeakMap();
  const pausedSources = new WeakMap();
  const pausedPositions = new WeakMap();
  const playbackPositions = new Map();
  function selectionKey(file) {
    if (!file || typeof file !== "object") throw new Error("personal_journal_invalid_media");
    if (!fileSelections.has(file)) fileSelections.set(file, key());
    return fileSelections.get(file);
  }
  function completedReceipt(file, journalId) {
    const receipt = completedMedia.get(file);
    return receipt?.journalId === journalId ? receipt : null;
  }
  const client = () => {
    const value = root.TennisNoteDataClient;
    if (!value?.getSession?.()?.access_token || !value.rpc) throw new Error("personal_journal_login_required");
    return value;
  };
  const call = (action, payload = {}) => client().rpc("tn_personal_journal", { target_action: action, payload });
  async function refreshMediaUrl(item) {
    if (!item?.serverMediaId || !item.storagePath) throw new Error("personal_journal_media_not_owned");
    let freshUrl;
    try { freshUrl = await client().createSignedObjectUrl(bucket, item.storagePath); }
    catch { item.mediaFailureKind = "signed_url"; throw new Error("personal_journal_media_sign_failed"); }
    if (!/^(https:|blob:)/.test(String(freshUrl || ""))) {
      item.mediaFailureKind = "signed_url";
      throw new Error("personal_journal_media_url_invalid");
    }
    if (String(item.url || "").startsWith("blob:") && item.url !== freshUrl) URL.revokeObjectURL(item.url);
    item.url = freshUrl;
    item.urlIssuedAt = Date.now();
    delete item.error;
    delete item.mediaFailureKind;
    return freshUrl;
  }
  function errorMessage(error, action = "save") {
    const message = [error?.code, error?.message, error?.status, error?.statusCode].filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, "_");
    if (/personal_journal_invalid_content/.test(message)) return "오늘 운동 기록을 입력해 주세요.";
    if (/stale_revision|existing_revision/.test(message)) return "다른 화면에서 변경된 기록입니다. 다시 불러온 뒤 수정해 주세요. 입력 내용은 유지됩니다.";
    if (/invalid_media/.test(message)) return "사진은 파일당 100MB, 영상은 파일당 1GB 이하의 MP4·MOV·WebM만 첨부할 수 있습니다.";
    if (/mp4_prepare_failed/.test(message)) return "이 영상은 재생용 준비를 안전하게 완료하지 못했습니다. 원본 파일과 입력은 유지됩니다. 다른 MP4로 다시 시도해 주세요.";
    if (/pending_media_verification_required/.test(message)) return "이전 첨부의 저장 상태를 먼저 확인해야 합니다. 기록을 다시 열어 확인해 주세요. 새 첨부는 저장하지 않았습니다.";
    if (/owner_required|not_owned|auth_profile_mapping_ambiguous|42501|403/.test(message)) return "개인운동 기록의 접근 권한을 확인하지 못했습니다. 본인 기록만 이용할 수 있습니다. 기존 기록과 입력은 유지됩니다. 문제가 계속되면 관리자에게 문의해 주세요.";
    if (/login_required/.test(message)) return "로그인이 필요합니다. 입력 내용은 유지됩니다.";
    if (action === "list") return "개인운동 기록을 불러오지 못했습니다. 기존 기록과 입력은 유지됩니다. 연결을 확인한 뒤 다시 열어 주세요.";
    return "서버 저장을 완료하지 못했습니다. 입력은 유지됩니다. 연결을 확인한 뒤 다시 저장해 주세요.";
  }
  function validateFiles(files) {
    for (const file of files) {
      const limit = String(file.type || "").startsWith("video/") ? videoMaxBytes : imageMaxBytes;
      if (!mimeTypes.has(file.type) || file.size < 1 || file.size > limit) throw new Error("personal_journal_invalid_media");
    }
  }
  function uploadProgress(uploaded, total) {
    const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((uploaded / total) * 100))) : 0;
    if (root.dispatchEvent && root.CustomEvent) {
      root.dispatchEvent(new root.CustomEvent("tennisnote:personal-journal-upload-progress", { detail: { percent } }));
    }
  }
  function body(log) {
    return { memo: log.memo || "", next: log.next || "", feedbackQuestion: log.feedbackQuestion || "" };
  }
  async function save(log, files = [], checkpoint = () => {}) {
    validateFiles(files);
    if (!String(log.memo || "").trim()) throw new Error("personal_journal_invalid_content");
    // 서버 기록/예약보다 먼저 MP4 구조를 확인한다. 실패하면 draft와 선택 파일을 그대로 둔다.
    const preparedFiles = [];
    for (const original of files) {
      if (original.type === "video/mp4") {
        if (root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent("tennisnote:personal-journal-prepare-progress"));
        if (!root.TennisNoteMp4Faststart?.prepare) throw new Error("personal_journal_mp4_prepare_failed");
        let upload;
        try { upload = await root.TennisNoteMp4Faststart.prepare(original); }
        catch { throw new Error("personal_journal_mp4_prepare_failed"); }
        if (!upload || upload.size !== original.size || upload.type !== original.type || upload.name !== original.name ||
          upload.lastModified !== original.lastModified) throw new Error("personal_journal_mp4_prepare_failed");
        preparedFiles.push({ original, upload });
      } else preparedFiles.push({ original, upload: original });
    }
    const selectedKeys = new Set(preparedFiles.map(({ original }) => selectionKey(original)));
    if (Object.keys(log.personalPendingMedia || {}).some((pendingKey) => !selectedKeys.has(pendingKey))) {
      throw new Error("personal_journal_pending_media_verification_required");
    }
    if (preparedFiles.some(({ original }) => {
      const receipt = completedReceipt(original, log.serverJournalId);
      return receipt && !(log.mediaItems || []).some((item) => item.serverMediaId === receipt.mediaId
        && item.storagePath === receipt.storagePath);
    })) throw new Error("personal_journal_pending_media_verification_required");
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
    for (const { original, upload: file } of preparedFiles) {
      const fingerprint = selectionKey(original);
      // Only this exact File selection may reuse a completed server receipt.
      const completed = completedReceipt(original, log.serverJournalId);
      const existingItem = (log.mediaItems || []).find((item) => item.serverMediaId && item.storagePath
        && (item.uploadSelectionKey === fingerprint || (completed && item.serverMediaId === completed.mediaId
          && item.storagePath === completed.storagePath)));
      if (existingItem) { existingItem.uploadSelectionKey = fingerprint; continue; }
      log.personalPendingMedia ||= {};
      const uploadKey = log.personalPendingMedia[fingerprint] || key();
      log.personalPendingMedia[fingerprint] = uploadKey;
      checkpoint(log);
      const reservation = await client().rpc("tn_reserve_personal_journal_media", { payload: {
        journalId: log.serverJournalId, uploadKey, byteSize: file.size, mimeType: file.type,
      } });
      if (reservation.state !== "ready") {
        let finished = false;
        try { await client().uploadObject(bucket, reservation.storagePath, file, { resumable: file.type.startsWith("video/"), onProgress: uploadProgress }); }
        catch (error) {
          // 업로드 응답 손실도 서버의 exact metadata 확인으로만 성공 판정한다.
          // 오류 문자열에 URL/개인정보를 넣지 않는다.
          try {
            await call("finish_media", { operationKey: `ready:${reservation.mediaId}`, journalId: log.serverJournalId, mediaId: reservation.mediaId });
            finished = true;
          } catch { throw new Error("personal_journal_upload_incomplete"); }
        }
        if (!finished) await call("finish_media", { operationKey: `ready:${reservation.mediaId}`, journalId: log.serverJournalId, mediaId: reservation.mediaId });
      }
      // A failed immediate list must not turn a successfully saved server object
      // back into a local-only blob after a role switch or app restart.
      const localItem = (log.mediaItems || []).find((item) => !item.serverMediaId && item.uploadSelectionKey === fingerprint);
      if (localItem) {
        localItem.serverMediaId = reservation.mediaId;
        localItem.storagePath = reservation.storagePath;
        localItem.byteSize = file.size;
      }
      completedMedia.set(original, { journalId: log.serverJournalId, mediaId: reservation.mediaId,
        storagePath: reservation.storagePath });
      delete log.personalPendingMedia[fingerprint];
      if (!Object.keys(log.personalPendingMedia).length) delete log.personalPendingMedia;
      checkpoint(log);
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
          byteSize: Number(media.byte_size) || 0, serverMediaId: media.id, storagePath: media.storage_path, url: "" };
        try {
          item.url = media.media_type === "video" && client().createSignedObjectUrl
            ? await refreshMediaUrl(item)
            : URL.createObjectURL(await client().downloadObject(bucket, media.storage_path));
        }
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
  function mediaPositionKey(media) {
    const detail = media.closest?.("#journalDetailContent");
    const index = media.dataset?.journalMediaIndex;
    return detail?.dataset.journalEntryId && index !== undefined ? `${detail.dataset.journalEntryId}:${index}` : "";
  }
  function restorePlaybackPosition(media) {
    const position = pausedPositions.get(media) ?? playbackPositions.get(mediaPositionKey(media));
    if (!(position > 0)) return;
    const restore = () => {
      if (!media.isConnected || media.readyState < 1) return;
      try { media.currentTime = Number.isFinite(media.duration) ? Math.min(position, Math.max(0, media.duration - 0.01)) : position; }
      catch { /* 디코더 준비 전에는 재생 위치 변경을 강제하지 않는다. */ }
    };
    if (media.readyState >= 1) restore();
    else media.addEventListener("loadedmetadata", restore, { once: true });
  }
  // Background/close releases the WebKit decoder and audio source without autoplay.
  function pauseDetailMedia({ resumeOnVisible = false } = {}) {
    for (const media of root.document?.querySelectorAll?.("#journalDetailContent video, #journalDetailContent audio") || []) {
      const position = Number(media.currentTime) || 0;
      if (position > 0) {
        pausedPositions.set(media, position);
        const positionKey = mediaPositionKey(media);
        if (positionKey) {
          playbackPositions.set(positionKey, position);
          if (playbackPositions.size > 32) playbackPositions.delete(playbackPositions.keys().next().value);
        }
      }
      try { media.pause(); } catch { /* 분리 중인 요소도 나머지 정지를 막지 않는다. */ }
      const source = media.getAttribute("src");
      if (resumeOnVisible && source) pausedSources.set(media, source);
      else pausedSources.delete(media);
      media.removeAttribute("src");
      try { media.load(); } catch { /* 분리 중인 요소도 나머지 정리를 막지 않는다. */ }
    }
  }
  function resumeDetailMedia() {
    for (const media of root.document?.querySelectorAll?.("#journalDetailContent video, #journalDetailContent audio") || []) {
      const source = pausedSources.get(media);
      if (!source || !media.isConnected) continue;
      pausedSources.delete(media);
      media.setAttribute("src", source);
      restorePlaybackPosition(media);
      media.load();
    }
  }
  root.document?.addEventListener?.("visibilitychange", () => {
    if (root.document.hidden) pauseDetailMedia({ resumeOnVisible: true });
    else resumeDetailMedia();
  });
  root.addEventListener?.("pagehide", () => pauseDetailMedia({ resumeOnVisible: true }));
  root.addEventListener?.("pageshow", resumeDetailMedia);
  root.TennisNotePersonalJournal = Object.freeze({ key, selectionKey, completedReceipt, save, remove, load, cleanup, release, refreshMediaUrl, errorMessage, validateFiles, pauseDetailMedia, restorePlaybackPosition });
})(typeof window === "undefined" ? globalThis : window);
