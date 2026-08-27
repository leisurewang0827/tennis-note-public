// 코치 프로필과 회원 NTRP 를 저장하는 함수들.
//
// 코치가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function saveCoachProfile() {
  const name = currentCoachName();
  const existing = state.coachProfiles[name] || {};
  state.coachProfiles[name] = {
    ...existing,
    intro: $("#coachIntro")?.value.trim() || "",
    specialty: $("#coachSpecialty")?.value.trim() || "",
    lessonStyle: $("#coachLessonStyle")?.value.trim() || "",
    availableMemo: $("#coachAvailableMemo")?.value.trim() || "",
    memberMessage: $("#coachMemberMessage")?.value.trim() || "",
  };
  renderCoachProfile();
  saveSnapshot();
}

function updateCoachPhoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const name = currentCoachName();
    const photoDataUrl = String(reader.result || "");
    state.coachProfiles[name] = {
      ...(state.coachProfiles[name] || {}),
      photo: photoDataUrl,
    };
    if (state.coach) state.coach.profilePhotoUrl = photoDataUrl;
    renderCoachProfile();
    saveSnapshot();
    const client = window.TennisNoteDataClient;
    if (state.dataMode === "live" && state.liveProfileId && client?.updateRows) {
      try {
        await client.updateRows("tn_users", { id: state.liveProfileId }, {
          profile_photo_url: photoDataUrl || null,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn("Tennis Note coach profile photo save failed", error);
      }
    }
  };
  reader.readAsDataURL(file);
}

async function updateMemberNtrp(memberId, value, groupName = "") {
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return;
  const previousValue = member.coachNtrp;
  const previousRequest = member.ntrpRequest;
  if (groupName) {
    member.groupCoachNtrp = {
      ...(member.groupCoachNtrp || {}),
      [groupName]: value,
    };
  } else {
    member.coachNtrp = value;
  }
  member.ntrpRequest = value === "측정 전" ? "요청" : "완료";
  const request = state.ntrpRequests.find((item) => item.member === (groupName || member.name));
  if (request) {
    request.coachNtrp = value;
    request.status = value === "측정 전" ? "측정 요청" : "측정 완료";
    exportNtrpResult(request);
  }
  if (!groupName && member.serverUserId && window.TennisNoteDataClient?.rpc) {
    try {
      await window.TennisNoteDataClient.rpc("tn_coach_update_member_ntrp", {
        target_user_id: member.serverUserId,
        target_coach_ntrp: value === "측정 전" ? null : Number(value),
      });

      showToast(value === "측정 전" ? "NTRP 측정 요청 상태로 변경" : "코치 NTRP 저장 완료");
    } catch (error) {
      member.coachNtrp = previousValue;
      member.ntrpRequest = previousRequest;
      showToast(`NTRP 서버 저장 실패: ${error?.message || "server_error"}`);
    }
  }
  renderMembers();
  saveSnapshot();
}
