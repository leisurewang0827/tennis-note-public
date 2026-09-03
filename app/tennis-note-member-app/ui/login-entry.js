const recentLoginProviderStorageKey = "tennis-note-recent-login-provider-v1";
const recentLoginProviderLabels = Object.freeze({
  "custom:naver": "네이버",
  naver: "네이버",
  "custom:kakao": "카카오",
  kakao: "카카오",
  apple: "Apple",
  email: "이메일",
});

function recentLoginProviderLabel(provider) {
  return recentLoginProviderLabels[String(provider || "").trim().toLowerCase()] || "";
}

function renderRecentLoginBadge() {
  const badge = $("#memberRecentLoginBadge");
  if (!badge) return;
  const label = recentLoginProviderLabel(sessionStorage.getItem(recentLoginProviderStorageKey));
  badge.hidden = !label;
  badge.textContent = label ? `최근 ${label} 로그인` : "";
}

function rememberRecentLoginProvider(provider) {
  const label = recentLoginProviderLabel(provider);
  if (label) sessionStorage.setItem(recentLoginProviderStorageKey, String(provider));
  renderRecentLoginBadge();
}
