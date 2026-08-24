// 공개 온보딩 — 서버에 붙는 것.
//
// 로그인 전에도 상품과 코치 일정을 보여줘야 해서 공개 조회를 따로 부른다.

async function syncPublicMembershipProductsFromServer() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.rpc) {
    state.publicMembershipProductStatus = "error";
    renderPublicProductPreview();
    return false;
  }
  try {
    const rows = await client.rpc("tn_public_membership_product_catalog", {});
    const products = (Array.isArray(rows) ? rows : [])
      .map(membershipProductFromServer)
      .filter((product) => product.status !== "hidden" && Number(product.cardAmount || 0) > 0);
    state.publicMembershipProducts = products;
    state.publicMembershipProductStatus = products.length ? "ready" : "error";
    renderPublicProductPreview();
    const intent = storedOnboardingIntent();
    if (["coach", "time"].includes(publicOnboardingStage(intent))) {
      void syncPublicPurchaseDirectory(publicOnboardingProduct(intent));
    }
    return products.length > 0;
  } catch {
    state.publicMembershipProducts = [];
    state.publicMembershipProductStatus = "error";
    renderPublicProductPreview();
    return false;
  }
}

async function syncPublicPurchaseDirectory(product = publicOnboardingProduct(), options = {}) {
  const client = window.TennisNoteDataClient;
  const context = publicOnboardingDirectoryContext(product);
  if (!client?.readiness?.().ready || !client.rpc || !context.branchId) {
    publicPurchaseDirectoryLoad = { key: context.key, status: "error", error: "public_purchase_directory_unavailable" };
    renderPublicProductPreview();
    return false;
  }
  if (!options.force && publicPurchaseDirectoryCache?.key === context.key) {
    publicPurchaseDirectoryLoad = { key: context.key, status: "ready", error: "" };
    renderPublicProductPreview();
    return true;
  }
  publicPurchaseDirectoryLoad = { key: context.key, status: "loading", error: "" };
  renderPublicProductPreview();
  try {
    const directory = await client.rpc("tn_public_membership_purchase_directory", {
      target_branch_id: context.branchId,
      target_from: context.from,
      target_to: context.to,
    });
    if (!directory || String(directory.branchId || "") !== context.branchId || !Array.isArray(directory.coaches) || !Array.isArray(directory.occupancy)) {
      throw new Error("public_purchase_directory_response_invalid");
    }
    publicPurchaseDirectoryCache = { key: context.key, loadedAt: Date.now(), directory };
    publicPurchaseDirectoryLoad = { key: context.key, status: "ready", error: "" };
  } catch (error) {
    publicPurchaseDirectoryLoad = { key: context.key, status: "error", error: error?.payload?.code || error?.message || "public_purchase_directory_failed" };
  }
  renderPublicProductPreview();
  return publicPurchaseDirectoryLoad.status === "ready";
}

async function recordOnboardingIntent(intent = storedOnboardingIntent()) {
  const client = window.TennisNoteDataClient;
  if (!intent || !hasLiveMemberSession() || !client?.rpc) return false;
  const recordKey = `${state.member?.profileId || ""}:${intent.source}:${intent.start}`;
  if (onboardingIntentRecordedKey === recordKey) return true;
  try {
    await client.rpc("tn_record_my_onboarding_entry", {
      target_source_channel: intent.source,
      target_start_intent: intent.start,
      target_entry_path: window.location.pathname,
    });
    onboardingIntentRecordedKey = recordKey;
    return true;
  } catch {
    return false;
  }
}
