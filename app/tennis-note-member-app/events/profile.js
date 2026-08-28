// 프로필·신원 확인·푸시 알림·계정 삭제·NTRP.
//
// bindEvents() 에서 본문 그대로 잘라 옮겼다. app.js 의 bindEvents() 가
// 이 함수들을 순서대로 부른다.

function bindProfileEvents() {
  $("#profilePhotoInput")?.addEventListener("change", handleProfilePhotoChange);
  $("#removeProfilePhoto")?.addEventListener("click", removeProfilePhoto);
  $("#saveProfileInfo")?.addEventListener("click", saveProfileInfo);
  $("#profileNicknameCheckButton")?.addEventListener("click", () => checkNicknameAvailability("profileNicknameInput", "profileNicknameStatus"));
  $("#profileNicknameInput")?.addEventListener("input", () => setNicknameStatus("profileNicknameStatus", "저장할 때 중복 여부를 다시 확인합니다."));
  $("#profilePhoneInput")?.addEventListener("input", (event) => {
    event.target.value = formatIdentityPhone(event.target.value);
  });
  $("#identitySetupForm")?.addEventListener("submit", submitIdentitySetup);
  $("#identityPhoneSendButton")?.addEventListener("click", requestIdentityPhoneVerification);
  $("#identityNaverPhoneButton")?.addEventListener("click", requestNaverPhoneConsent);
  $("#identityPhoneVerifyButton")?.addEventListener("click", confirmIdentityPhoneVerification);
  $("#identityNicknameCheckButton")?.addEventListener("click", () => checkNicknameAvailability("identityNickname", "identityNicknameStatus"));
  $("#identityNickname")?.addEventListener("input", () => setNicknameStatus("identityNicknameStatus", "저장할 때 중복 여부를 다시 확인합니다."));
  $("#identityPhone")?.addEventListener("input", (event) => {
    event.target.value = formatIdentityPhone(event.target.value);
    const phone = normalizeIdentityPhone(event.target.value);
    if (identityPhoneVerification.status === "verified" && identityPhoneVerification.phone === phone) return;
    if (identityPhoneVerification.status === "pending" && identityPhoneVerification.phone === phone) return;
    resetIdentityPhoneVerification("휴대전화 번호가 바뀌었습니다. 인증번호를 받아 주세요.");
  });
  $("#identityPhoneCode")?.addEventListener("input", (event) => {
    event.target.value = normalizeIdentityPhone(event.target.value).slice(0, 6);
  });
  $("#identitySetupLogoutButton")?.addEventListener("click", logout);
  $("#openProfileEditorButton")?.addEventListener("click", () => openProfileEditor());
  $("#openProfileEditorMenuButton")?.addEventListener("click", () => openProfileEditor());
  $("#openNtrpEditorButton")?.addEventListener("click", () => openProfileEditor(true));
  $("#openDiscountCouponWalletButton")?.addEventListener("click", () => {
    renderDiscountCouponWallet();
    openAppSheet("discountCouponWalletSheet", { initialFocus: "[data-close-discount-coupon-wallet]" });
  });
  $("#discountCouponWalletSheet")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-discount-coupon-wallet]")) closeAppSheet("discountCouponWalletSheet");
  });
  $("#profileEditorSheet")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-profile-editor]")) closeAppSheet("profileEditorSheet");
  });
  $("#pushNotificationButton")?.addEventListener("click", async () => {
    try {
      if (state.pushNotifications?.permission === "granted") {
        await disableNativePushForMember();
      } else {
        localStorage.removeItem(pushPrimerDeferredStorageKey);
        setPushPreferenceEnabled(true);
        await syncNativePushRegistration(null, true);
      }
    } catch {
      setPushNotificationState("unknown", "알림 연결 실패", "네트워크와 앱 설정을 확인한 뒤 다시 시도해 주세요.");
    }
  });
  $("#bankNotificationBridgeButton")?.addEventListener("click", () => {
    void connectBankNotificationBridge();
  });
  $("#pushPrimerModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-defer-push-primer]")) deferNativePushPrimer();
  });
  $("#enablePushFromPrimer")?.addEventListener("click", enableNativePushFromPrimer);
  $("#openAccountDeletionButton")?.addEventListener("click", async () => {
    if (state.accountDeletionRequest?.status === "pending") await cancelAccountDeletionRequest();
    else openAccountDeletionModal();
  });
  $("#accountDeletionModal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-account-deletion-modal]")) closeAccountDeletionModal();
  });
  $("#accountDeletionForm")?.addEventListener("submit", submitAccountDeletionRequest);
  $("#requestNtrpCheck")?.addEventListener("click", requestNtrpCheck);
  $("#calculateNtrp")?.addEventListener("click", calculateNtrpFromSurvey);
  $("#ntrpReferenceCards")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-ntrp-reference]");
    if (button) openNtrpReference(button.dataset.openNtrpReference);
  });
}
