// 운동노트와 첨부 미디어를 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function mediaItemsFromInput(input) {
  return [...(input?.files || [])].map((file) => ({
    name: file.name,
    type: file.type || "",
    url: URL.createObjectURL(file),
  }));
}

function mediaItemsFromNames(names = []) {
  return names.map((name) => {
    const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(name);
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
    return {
      name,
      type: isVideo ? "video/demo" : isImage ? "image/demo" : "",
      url: "",
    };
  });
}

function normalizeMediaItems(log) {
  if (Array.isArray(log.mediaItems) && log.mediaItems.length) return log.mediaItems;
  return mediaItemsFromNames(log.mediaNames || []);
}

function journalMediaType(file = {}) {
  if (String(file.type || "").startsWith("video/")) return "video";
  return "image";
}

function safeJournalObjectName(file = {}, index = 0) {
  const extension = String(file.name || "media.bin").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const uniqueId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}`;
  return `${uniqueId}.${extension}`;
}

function parseServerJournalBody(body = "") {
  try {
    const payload = JSON.parse(body || "{}");
    return payload?.schema === serverJournalSchema ? payload : null;
  } catch {
    return null;
  }
}

function serverJournalBody(log = {}) {
  return JSON.stringify({
    schema: serverJournalSchema,
    clientLogId: log.id,
    lessonId: log.lessonId,
    lessonLabel: log.lessonLabel,
    round: log.round,
    content: log.content,
    selfMemo: log.selfMemo,
    curriculumId: log.curriculum?.id || log.nextCurriculumId || "FH-01",
    nextCurriculumId: log.nextCurriculumId || log.curriculum?.id || "FH-01",
    mediaNames: log.mediaNames || [],
    submittedAt: log.submittedAt,
  });
}

async function downloadServerMediaItem(client, row, displayName = "첨부파일") {
  const blob = await client.downloadObject(journalMediaBucket, row.storage_path);
  return {
    name: displayName,
    type: row.media_type === "video" ? (blob.type || "video/mp4") : (blob.type || "image/jpeg"),
    url: URL.createObjectURL(blob),
    storagePath: row.storage_path,
    serverMediaId: row.id,
  };
}

function journalActivityLessonStatus(lesson) {
  const source = String(lesson.lessonSource || lesson.lesson_source || "").toLowerCase();
  const status = String(lesson.serverStatus || lesson.status || "scheduled").toLowerCase();
  if (source === "makeup" || String(lesson.type || "").includes("보강")) return "makeup_booked";
  if (status === "no_show") return "no_show";
  if (["absence", "absent"].includes(status)) return "absent";
  if (["completed", "confirmed"].includes(status)) return "completed";
  if (["scheduled", "pending_change", "requested"].includes(status)) return "scheduled";
  return "";
}

function journalMatchesSearch(entry, rawQuery) {
  const query = (rawQuery || "").trim().toLowerCase();
  if (!query) return true;
  return [entry.kind, entry.dateLabel, entry.title, entry.subtitle, entry.body, entry.note, entry.next, ...(entry.mediaNames || [])]
    .some((value) => `${value || ""}`.toLowerCase().includes(query));
}

function journalDateLabel(dateValue) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "선택한 날짜";
  return parsed.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function selectedNextText(log) {
  const step = curriculumById(log.nextCurriculumId || log.curriculum?.id, log.curriculum);
  return step?.title ? `다음: ${step.title}` : "";
}
