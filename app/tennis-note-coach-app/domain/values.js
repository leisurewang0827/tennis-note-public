// 한 가지 값을 다듬거나 재는 작은 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function coachKeyFromName(name = "") {
  if (name.includes("노")) return "coach-no";
  if (name.includes("강")) return "coach-kang";
  if (name.includes("황")) return "coach-hwang";
  if (name.includes("박")) return "coach-park";
  return "";
}

function shortCoachName(name = "") {
  return name.replace(" 코치", "").replace("코치", "").trim();
}

function canonicalCoachName(name = "") {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const rawShort = shortCoachName(raw);
  const matched = approvedCoachesFromAdmin().find((coach) => coach.name === raw || shortCoachName(coach.name) === rawShort);
  return shortCoachName(matched?.name || raw);
}

function personPhotoUrl(person = {}) {
  return String(person.profilePhotoUrl || person.photoUrl || person.photo || "").trim();
}

function personAvatarInnerMarkup(person = {}) {
  const name = person.name || person.displayName || "사용자";
  const photoUrl = personPhotoUrl(person);
  return `
    <span class="person-avatar-placeholder" aria-hidden="true"></span>
    ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)} 프로필 사진" loading="lazy" onerror="this.parentElement.classList.remove('has-photo');this.parentElement.classList.add('is-empty');this.remove()" />` : ""}`;
}

function personAvatarMarkup(person = {}, size = "tiny") {
  const name = person.name || person.displayName || "사용자";
  const hasPhoto = Boolean(personPhotoUrl(person));
  return `<span class="person-avatar ${size} ${hasPhoto ? "has-photo" : "is-empty"}" aria-label="${escapeHtml(hasPhoto ? `${name} 프로필 사진` : "기본 프로필 이미지")}">${personAvatarInnerMarkup(person)}</span>`;
}

function coachFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function currentCoachName() {
  return canonicalCoachName(state.coach?.name || state.selectedCoachName || approvedCoachesFromAdmin()[0]?.name || "노 코치");
}

function currentCoachRoleId() {
  return String(state.coach?.coachRoleId || "").trim();
}

function formatCoachWon(value) {
  return `${new Intl.NumberFormat("ko-KR").format(Math.max(0, Math.round(Number(value) || 0)))}원`;
}

function maskPhone(phone) {
  if (!phone) return "연락처 미입력";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 7) return "연락처 확인 필요";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function ntrpNumber(value) {
  return value && value !== "측정 전" ? value : "-";
}

function memberGenderLabel(value = "") {
  return { female: "여", male: "남", other: "기타", prefer_not: "미응답" }[value] || "미입력";
}

function normalizeCoachComment(text) {
  return (text || "")
    .replace(/\s+/g, "")
    .replace(/[.,!?~ㆍ·]/g, "")
    .toLowerCase();
}
