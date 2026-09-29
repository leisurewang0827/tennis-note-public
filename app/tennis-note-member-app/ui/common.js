// common 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function journalServerMediaRetryMessage() {
  return "저장된 첨부의 재생에 문제가 있습니다. 원본은 보존됩니다. 다시 열어 확인해 주세요.";
}

function journalMediaFailureKind(media) {
  const code = Number(media?.error?.code) || 0;
  return code === 3 || code === 4 ? "decoder" : "get";
}

async function handleJournalMediaPreviewError(event) {
  const media = event.target;
  if (!media?.matches?.("[data-journal-media-preview]") || media.dataset.previewFailed || media.dataset.previewRetrying) return;
  const detail = media.closest("#journalDetailContent");
  const log = state.practiceLogs.find((item) => item.id === detail?.dataset.journalEntryId);
  const item = log?.mediaItems?.[Number(media.dataset.journalMediaIndex)];
  if (item?.serverMediaId && item.storagePath && !media.dataset.previewRetried) {
    media.dataset.previewRetried = "true";
    media.dataset.previewRetrying = "true";
    try {
      const url = await window.TennisNotePersonalJournal.refreshMediaUrl(item);
      if (!media.isConnected || detail.dataset.journalEntryId !== log.id) return;
      media.src = url;
      media.load?.();
      return;
    } catch { item.mediaFailureKind = "signed_url"; /* 기존 첨부를 보존한다. */ }
    finally { delete media.dataset.previewRetrying; }
  }
  if (!media.isConnected) return;
  if (item && item.mediaFailureKind !== "signed_url") item.mediaFailureKind = journalMediaFailureKind(media);
  // Preserve the failed node for decoder diagnostics, without claiming the server object was lost.
  media.dataset.previewFailed = "true";
  media.hidden = true;
  const notice = document.createElement("p");
  notice.setAttribute("role", "status");
  notice.textContent = item?.serverMediaId ? journalServerMediaRetryMessage() : journalMediaUnavailableMessage();
  media.after(notice);
}

function focusJournalActivity(status) {
  const today = localDateKey();
  const matches = journalActivityItems()
    .filter((item) => item.status === status)
    .sort((left, right) => {
      const leftFuture = left.dateValue >= today ? 0 : 1;
      const rightFuture = right.dateValue >= today ? 0 : 1;
      return leftFuture - rightFuture || left.dateValue.localeCompare(right.dateValue);
    });
  if (!matches.length) return;
  const calendarDisclosure = $("#journalCalendarDisclosure");
  if (calendarDisclosure) {
    calendarDisclosure.open = true;
    calendarDisclosure.dataset.userToggled = "true";
  }
  selectJournalDate(matches[0].dateValue);
  $("#journalSelectedDayPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
