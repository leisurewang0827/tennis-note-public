// 서버(Supabase)에서 공통 데이터를 가져오는 함수들.
//
// 서버에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function loadAdminDataOnce(key, loader) {
  const existing = adminLazyDataState.get(key);
  if (existing?.status === "loaded") return Promise.resolve(false);
  if (existing?.promise) return existing.promise;

  const entry = { status: "loading", promise: null };
  entry.promise = Promise.resolve()
    .then(loader)
    .then(() => {
      entry.status = "loaded";
      entry.promise = null;
      return true;
    })
    .catch((error) => {
      entry.status = "failed";
      entry.promise = null;
      console.warn(`[Tennis Note] ${key} lazy load failed`, error);
      return false;
    });
  adminLazyDataState.set(key, entry);
  return entry.promise;
}

function ensureAdminViewData(view = state.view, settingsTab = state.settingsTab) {
  if (!operationsAccessReady()) return Promise.resolve([]);
  const jobs = [];

  if (view === "members") {
    jobs.push(
      loadAdminDataOnce("member-requests", () => Promise.all([
        loadServerHoldingRequests(),
        loadServerAccountDeletionRequests(),
        checkAccountDeletionServerReadiness(),
        loadMemberManagementPolicyFromServer(),
        loadMemberEditorModeFromServer(),
      ])),
    );
    jobs.push(loadAdminMemberDirectoryPage());
  }

  if (view === "billing") {
    jobs.push(loadAdminDataOnce("settlement-support", loadAdminSettlementSupportData));
  }

  if (view === "settings") {
    if (settingsTab === "live") {
      const branchKey = activeOperationBranchId() || "unselected";
      jobs.push(loadAdminDataOnce(`branch-payment-account:${branchKey}`, () => Promise.all([
        loadBranchPaymentAccountFromServer(),
        loadBankNotificationStatusFromServer(),
      ])));
    }
    if (settingsTab === "membership") {
      const branchKey = activeOperationBranchId() || "unselected";
      jobs.push(
        loadAdminDataOnce(`membership-policy:${branchKey}`, () => Promise.all([
          loadBranchSalesSettingsFromServer(),
          loadBranchSalesEffectiveOptionsFromServer(),
          loadBranchPaymentAccountFromServer(),
          loadBankNotificationStatusFromServer(),
          loadServerHoldingPolicy(),
          loadRefundPolicySettingsFromServer(),
          loadPolicyVersionsFromServer(),
          loadLessonPoliciesFromServer(),
          loadDiscountPoliciesFromServer(),
        ])),
      );
    }
    if (settingsTab === "notifications") {
      jobs.push(
        loadAdminDataOnce("notification-operations", async () => {
          await loadNotificationPolicyFromServer();
          await loadNotificationDeliveryStatus();
        }),
      );
    }
    if (settingsTab === "coach") {
      jobs.push(loadAdminDataOnce("coach-staff-detail", refreshCoachStaffData));
    }
  }

  if (view === "notes") {
    jobs.push(loadAdminDataOnce("records-support", loadAdminRecordsSupportData));
  }

  if (view === "reports") {
    jobs.push(loadAdminDriveReportSnapshot());
  }

  if (!jobs.length) return Promise.resolve([]);
  return Promise.all(jobs).then((results) => {
    if (view !== state.view || !results.some(Boolean)) return results;
    if (view === "members") {
      // The directory loader renders its own rows. Rebuilding the full inline
      // member sheet here made every menu visit render the same list twice.
      renderHoldingRequestAdminList();
      renderAccountDeletionAdminList();
    } else {
      renderAdminView(view);
    }
    return results;
  });
}

async function loadAdminRecordsSupportData() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows) return false;
  const [curriculumRefs, journalEntries, mediaFiles, lessonRecords, participantRecords] = await Promise.all([
    client.selectRows("tn_curriculum_refs", {
      select: "id,level_label,skill_label,title,notion_url,status",
      filters: { status: "active" },
      order: "level_label.asc",
      limit: 500,
    }).catch(() => []),
    client.selectRows("tn_journal_entries", {
      select: "id,user_id,lesson_id,entry_date,entry_type,practice_type,body,created_at,updated_at",
      order: "entry_date.desc",
      limit: 500,
    }).catch(() => []),
    client.selectRows("tn_media_files", {
      select: "id,owner_user_id,journal_entry_id,storage_path,media_type,created_at",
      order: "created_at.desc",
      limit: 1000,
    }).catch(() => []),
    client.selectRows("tn_lesson_records", {
      select: "id,lesson_id,coach_role_id,coach_comment,next_curriculum_ref_id,deducted_sessions,completed_at",
      order: "completed_at.desc",
      limit: 500,
    }).catch(() => adminLiveDataState.lessonRecords || []),
    client.selectRows("tn_lesson_participant_records_v2", {
      select: "id,lesson_id,user_id,ticket_id,coach_role_id,outcome,record_status,deduction_requested,deducted_sessions,technique,strength,improvement,next_goal,coach_comment,feedback_keywords,next_curriculum_ref_id,member_journal_id,warning_codes,revision,finalized_at,created_at,updated_at",
      order: "updated_at.desc",
      limit: 2000,
    }).catch(() => adminLiveDataState.participantRecords || []),
  ]);
  Object.assign(adminLiveDataState, {
    curriculumRefs,
    journalEntries,
    mediaFiles,
    lessonRecords,
    participantRecords,
  });
  const loadedLessonById = new Map(
    lessons.filter((lesson) => lesson.serverLessonId).map((lesson) => [lesson.serverLessonId, lesson]),
  );
  replaceArray(lessonNotes, (lessonRecords || []).map((record) => {
    const lesson = loadedLessonById.get(record.lesson_id);
    const coachName = lesson?.coachId
      ? getCoachName(lesson.coachId)
      : coachNameForRoleId(record.coach_role_id);
    const completedDate = String(record.completed_at || "").slice(0, 10);
    return {
      id: record.id,
      serverRecordId: record.id,
      serverLessonId: record.lesson_id,
      coachRoleId: record.coach_role_id,
      member: lesson?.member || "회원 확인 필요",
      lesson: lesson
        ? `${lesson.lessonDate || completedDate} ${lesson.time || ""} ${coachName}`.trim()
        : `${completedDate || "완료일 미확인"} ${coachName}`.trim(),
      reflection: record.coach_comment || "코치 코멘트 없음",
      next: record.next_curriculum_ref_id ? "다음 커리큘럼 등록됨" : "다음 커리큘럼 미등록",
      nextCurriculumRefId: record.next_curriculum_ref_id || "",
      completedAt: record.completed_at || "",
      status: "confirmed",
      statusLabel: "확인완료",
      deductedSessions: Number(record.deducted_sessions) || 0,
    };
  }));
  return true;
}

function ensureAdminToolData(tool) {
  if (tool !== "data") return Promise.resolve([]);
  return Promise.all([
    loadAdminDataOnce("supabase-status", loadSupabaseLiveStatus),
    loadAdminDataOnce("auth-provider-status", loadAuthProviderStatus),
  ]).then((results) => {
    renderSupabaseLiveStatus();
    renderAuthProviderStatus();
    return results;
  });
}

async function verifyAdminPin(value) {
  const pin = `${value || ""}`.trim();
  if (!pin || adminPinNeedsSetup()) return false;
  if (adminLockSettings.pinHash) {
    const hash = await createAdminPinHash(pin);
    return hash === adminLockSettings.pinHash || fallbackAdminPinHash(pin) === adminLockSettings.pinHash;
  }
  const legacyPin = `${adminLockSettings.legacyPin || ""}`.trim();
  if (adminLockSettings.pinConfigured && !legacyPin) {
    const client = window.TennisNoteDataClient;
    if (!client?.rpc || !adminApprovalReady()) return false;
    try {
      return Boolean(await client.rpc("tn_admin_verify_security_pin", { target_pin: pin }));
    } catch {
      return false;
    }
  }
  const ok = pin === legacyPin;
  if (ok) {
    adminLockSettings.pinHash = await createAdminPinHash(pin);
    adminLockSettings.legacyPin = "";
    saveSnapshot();
  }
  return ok;
}

async function loadServerHoldingRequests() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) return false;
  try {
    const rows = await client.selectRows("tn_holding_requests", {
      select: "id,user_id,ticket_id,request_type,requested_start_on,requested_end_on,reason_summary,evidence_object_path,evidence_status,status,reviewed_at,created_at",
      limit: 100,
    });
    const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
    const userNames = {};
    await Promise.all(userIds.map(async (userId) => {
      const users = await client.selectRows("tn_users", { select: "id,name", filters: { id: userId }, limit: 1 }).catch(() => []);
      userNames[userId] = users?.[0]?.name || "회원";
    }));
    const shared = loadSharedData();
    const demoRequests = (shared.holdingRequests || []).filter((request) => request.source !== "server");
    const liveRequests = (rows || []).map((row) => ({
      id: row.id,
      member: userNames[row.user_id] || "회원",
      ticketId: row.ticket_id,
      ticketTitle: "회원권",
      type: row.request_type,
      typeLabel: row.request_type === "injury" ? "부상·입원" : "개인 사유",
      startDate: row.requested_start_on,
      endDate: row.requested_end_on,
      days: holdingRequestDays(row.requested_start_on, row.requested_end_on),
      reason: row.reason_summary || "",
      evidencePath: row.evidence_object_path || "",
      evidenceLabel: row.request_type === "injury" ? "증빙 첨부" : "증빙 없음",
      status: row.status || "pending",
      source: "server",
      reviewedAt: row.reviewed_at || "",
      createdAt: row.created_at || "",
    }));
    shared.holdingRequests = [...liveRequests, ...demoRequests];
    saveSharedData(shared);
    renderHoldingRequestAdminList();
    return true;
  } catch {
    return false;
  }
}

async function loadServerAccountDeletionRequests() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows || !client.getSession?.()?.access_token) {
    Object.assign(accountDeletionRequestState, { loading: false, error: "login_required" });
    renderAccountDeletionAdminList();
    return false;
  }
  Object.assign(accountDeletionRequestState, { loading: true, error: "" });
  renderAccountDeletionAdminList();
  try {
    const rows = await client.selectRows("tn_account_deletion_requests", {
      select: "*",
      limit: 100,
    });
    const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
    const userNames = {};
    await Promise.all(userIds.map(async (userId) => {
      const users = await client.selectRows("tn_users", { select: "id,name", filters: { id: userId }, limit: 1 }).catch(() => []);
      userNames[userId] = users?.[0]?.name || "회원";
    }));
    state.accountDeletionRequests = (rows || [])
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        member: userNames[row.user_id] || "회원",
        status: row.status || "pending",
        reason: row.reason_summary || "",
        adminNote: row.admin_note || "",
        retainedDataSummary: row.retained_data_summary || "",
        executionAttempts: Number(row.execution_attempts || 0),
        lastErrorCode: row.last_error_code || "",
        appleRevokeStatus: row.apple_revoke_status || "not_applicable",
        authDeleteStatus: row.auth_delete_status || "pending",
        requestedAt: row.requested_at || "",
        reviewedAt: row.reviewed_at || "",
        executionStartedAt: row.execution_started_at || "",
        completedAt: row.completed_at || "",
        createdAt: row.created_at || "",
      }))
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
    Object.assign(accountDeletionRequestState, { loaded: true, loading: false, error: "" });
    renderAccountDeletionAdminList();
    return true;
  } catch (error) {
    Object.assign(accountDeletionRequestState, {
      loading: false,
      error: String(error?.message || "account_deletion_requests_load_failed"),
    });
    renderAccountDeletionAdminList();
    return false;
  }
}

async function loadNotificationDeliveryStatus() {
  const client = liveNoticeClient();
  if (!client?.selectRows) {
    Object.assign(notificationDeliveryState, {
      status: "offline",
      message: "관리자 로그인 후 확인",
      checkedAt: "",
    });
    renderNotificationPolicySettings();
    renderDashboardNoticeSummary();
    return false;
  }

  try {
    if (client.rpc) {
      try {
        const overview = await client.rpc("tn_admin_notification_overview", {});
        if (overview && typeof overview === "object") {
          applyNotificationOverview(Array.isArray(overview) ? overview[0] || {} : overview, "server");
          return true;
        }
      } catch (rpcError) {
        const message = String(rpcError?.message || rpcError || "");
        if (!message.includes("tn_admin_notification_overview") && !message.includes("PGRST202")) throw rpcError;
      }
    }

    const rows = await client.selectRows("tn_notifications", {
      select: "id,template_key,title,status,scheduled_at,sent_at,created_at,last_error",
      limit: 200,
    });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const appRows = Array.isArray(rows) ? rows : [];
    const recent = [...appRows]
      .sort((a, b) => String(b.sent_at || b.scheduled_at || b.created_at || "").localeCompare(String(a.sent_at || a.scheduled_at || a.created_at || "")))
      .slice(0, 8);
    applyNotificationOverview({
      queued: appRows.filter((row) => row.status === "queued").length,
      processing: appRows.filter((row) => row.status === "processing").length,
      sentToday: appRows.filter((row) => (
        row.status === "sent"
        && row.sent_at
        && new Date(row.sent_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) === today
      )).length,
      failed: appRows.filter((row) => (
        ["queued", "processing", "sent", "failed"].includes(row.status)
        && String(row.last_error || "")
        && !String(row.last_error || "").startsWith("no_active_push_device")
        && new Date(row.created_at || 0).getTime() >= sevenDaysAgo
      )).length,
      noDevice: appRows.filter((row) => (
        ["failed", "cancelled"].includes(row.status)
        && String(row.last_error || "").startsWith("no_active_push_device")
        && new Date(row.created_at || 0).getTime() >= sevenDaysAgo
      )).length,
      activeDevices: null,
      recent,
      generatedAt: new Date().toISOString(),
    }, "fallback");
    return true;
  } catch {
    Object.assign(notificationDeliveryState, {
      status: "blocked",
      message: "서버 권한 또는 알림 패치 확인 필요",
      checkedAt: new Date().toISOString(),
    });
    renderNotificationPolicySettings();
    renderDashboardNoticeSummary();
    return false;
  }
}

async function ensureAdminCurriculumRef(choiceValue) {
  if (!String(choiceValue).startsWith("catalog:")) return choiceValue;
  const code = String(choiceValue).slice("catalog:".length);
  const step = (window.TennisNoteCurriculumCatalog?.steps || []).find((item) => item.id === code);
  if (!step) throw new Error("curriculum_choice_not_found");
  return window.TennisNoteDataClient.rpc("tn_ensure_curriculum_ref", {
    target_code: step.id,
    target_level: `${step.trackTitle || step.category || "커리큘럼"} · ${step.stageLabel || step.level || "단계"}`,
    target_title: step.title,
    target_notion_url: step.notionUrl || "",
  });
}

function ensureXlsxLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLibraryPromise) return xlsxLibraryPromise;

  const sources = [
    "../shared/vendor/xlsx.full.min.js?v=0.18.5",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  ];
  xlsxLibraryPromise = new Promise((resolve, reject) => {
    const loadSource = (index) => {
      if (window.XLSX) {
        resolve(window.XLSX);
        return;
      }
      if (index >= sources.length) {
        reject(new Error("xlsx_module_load_failed"));
        return;
      }
      const script = document.createElement("script");
      script.src = sources[index];
      script.async = true;
      script.dataset.tennisnoteOptionalModule = "xlsx";
      script.onload = () => {
        if (window.XLSX) resolve(window.XLSX);
        else {
          script.remove();
          loadSource(index + 1);
        }
      };
      script.onerror = () => {
        script.remove();
        loadSource(index + 1);
      };
      document.head.append(script);
    };
    loadSource(0);
  }).catch((error) => {
    xlsxLibraryPromise = null;
    throw error;
  });
  return xlsxLibraryPromise;
}

async function refreshCoachStaffData() {
  const client = window.TennisNoteDataClient;
  if (!client?.selectRows || !operationsAccessReady()) return false;
  const serverCoachRoles = await client.selectRows("tn_coach_roles", {
    select: "id,user_id,branch_id,display_name,bio,color,status,job_title,employment_status,employment_started_on,employment_ended_on,archived_at,deleted_at,settlement_type,settlement_rate,hourly_rate,settlement_basis,settlement_calculation_mode,settlement_effective_from,availability_revision,schedule_lane_order",
    limit: 100,
  }).catch(() => client.selectRows("tn_coach_roles", {
    select: "id,user_id,branch_id,display_name,bio,color,status,settlement_type,settlement_rate,hourly_rate",
    limit: 100,
  }));
  const roleIds = serverCoachRoles.map((role) => role.id).filter(Boolean);
  const userIds = serverCoachRoles.map((role) => role.user_id).filter(Boolean);
  const [serverCoachAvailability, coachUsers, serverSettlementTerms] = await Promise.all([
    roleIds.length ? client.selectRows("tn_coach_availability", {
      select: "id,coach_role_id,day_of_week,start_time,end_time,availability_type,note",
      filters: { coach_role_id: { in: roleIds } },
      limit: 1000,
    }).catch(() => []) : [],
    userIds.length ? client.selectRows("tn_user_directory_safe", {
      select: "id,name,phone,profile_photo_url,role,status,auth_user_id,merged_into_user_id",
      filters: { id: { in: userIds } },
      limit: 200,
    }).catch(() => []) : [],
    roleIds.length ? client.selectRows("tn_coach_settlement_terms", {
      select: "id,coach_role_id,settlement_type,coach_rate,hourly_rate,settlement_basis,settlement_calculation_mode,substitute_policy,effective_from,effective_to,status",
      filters: { coach_role_id: { in: roleIds } },
      order: "effective_from.desc",
      limit: 500,
    }).catch(() => []) : [],
  ]);
  const candidatePhones = [...new Set(coachUsers.map((user) => normalizedMemberPhone(user.phone)).filter(Boolean))];
  const candidateUsers = candidatePhones.length ? await client.selectRows("tn_user_directory_safe", {
    select: "id,name,phone,profile_photo_url,role,status,auth_user_id,merged_into_user_id",
    filters: { phone: { in: candidatePhones } },
    limit: 500,
  }).catch(() => []) : [];
  const serverUsers = [...new Map([...coachUsers, ...candidateUsers].map((user) => [user.id, user])).values()];
  const relatedUserIds = serverUsers.map((user) => user.id).filter(Boolean);
  const [serverAuthLinks, serverAuthSwitches] = await Promise.all([
    relatedUserIds.length ? client.selectRows("tn_user_auth_links", {
      select: "id,user_id,provider,last_sign_in_at,is_primary",
      filters: { user_id: { in: relatedUserIds } },
      limit: 500,
    }).catch(() => []) : [],
    userIds.length ? client.selectRows("tn_auth_provider_switches", {
      select: "id,user_id,from_provider,to_provider,status,expires_at,created_at,completed_at",
      filters: { user_id: { in: userIds } },
      order: "created_at.desc",
      limit: 500,
    }).catch(() => []) : [],
  ]);
  applyServerCoachSnapshot({
    serverUsers,
    serverCoachRoles,
    serverCoachAvailability,
    serverAuthLinks,
    serverAuthSwitches,
    serverSettlementTerms,
  });
  adminLiveDataState.coachSettlementTerms = serverSettlementTerms;
  scheduleAdminOperationalCacheWrite();
  return true;
}

async function syncAdminLiveData(requireFresh = false, options = {}) {
  if (adminLiveSyncPromise) {
    if (!requireFresh) return adminLiveSyncPromise;
    await adminLiveSyncPromise;
    return syncAdminLiveData(false, options);
  }
  adminLiveSyncPromise = performAdminLiveDataSync(options);
  try {
    return await adminLiveSyncPromise;
  } finally {
    adminLiveSyncPromise = null;
  }
}

async function refreshAdminImportAuthState(options = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) {
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: null,
      profile: null,
      message: "Supabase 연결값을 먼저 설정해야 관리자 로그인을 확인할 수 있습니다.",
    });
    renderOperationsLoginGate();
    renderDataTools();
    return;
  }

  const session = client.getSession?.();
  if (!session?.access_token) {
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: null,
      profile: null,
      message: "관리자 로그인 후 서버 검증을 실행할 수 있습니다.",
    });
    renderOperationsLoginGate();
    renderDataTools();
    return;
  }

  Object.assign(adminImportAuthState, {
    loading: true,
    loaded: true,
    message: "로그인 권한 확인 중입니다.",
  });
  renderOperationsLoginGate();
  renderDataTools();

  try {
    const result = await client.selectCurrentProfile();
    const profile = result.profile || null;
    const role = profile?.role || "";
    if (!result.user && !client.getSession?.()?.access_token) {
      throw new Error("admin_session_expired");
    }
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: result.user || null,
      profile,
      message: role === "admin"
        ? `${profile.name || "관리자"} 관리자 계정으로 로그인했습니다.`
        : role === "coach"
          ? `${profile.name || "코치"} 코치 계정으로 로그인했습니다.`
          : role
            ? "이 계정에는 운영 화면 권한이 없습니다."
            : "로그인은 되었지만 운영 권한 연결이 필요합니다.",
    });
    adminAuthLastVerifiedAt = Date.now();
    writeCachedOperationsIdentity(result.user, profile);
    renderOperationsLoginGate();
    hideAdminBrandSplash();
    if (["admin", "coach"].includes(role)) {
      if (role === "coach" && !operationsViewAllowed(state.view)) state.view = "schedule";
      const restoredFromCache = await restoreAdminOperationalCache();
      setView(state.view, { skipLock: true });
      if (options.syncLiveData !== false) {
        if (restoredFromCache) {
          scheduleAdminInitialLiveSync();
        } else {
          await syncAdminLiveData();
          setView(state.view, { skipLock: true });
        }
      }
    }
    return ["admin", "coach"].includes(role);
  } catch (error) {
    const storedSession = client.getSession?.();
    const cachedIdentity = adminImportAuthState.profile
      ? { user: adminImportAuthState.user, profile: adminImportAuthState.profile }
      : readCachedOperationsIdentity();
    const canKeepAccess = Boolean(
      storedSession?.access_token
      && cachedIdentity?.user?.id
      && ["admin", "coach"].includes(cachedIdentity?.profile?.role)
      && (client.isTransientConnectionError?.(error) || client.isOnline?.() === false),
    );
    if (canKeepAccess) {
      Object.assign(adminImportAuthState, {
        loading: false,
        loaded: true,
        user: cachedIdentity.user,
        profile: cachedIdentity.profile,
        message: "서버 연결이 불안정합니다. 로그인은 유지되며 연결되면 자동으로 다시 확인합니다.",
      });
      renderOperationsLoginGate();
      renderAdminConnectivityStatus(true, "서버 연결이 불안정합니다. 로그인은 유지되며 자동으로 다시 확인합니다.", "warning", 0);
      renderDataTools();
      return false;
    }
    if (!storedSession?.access_token) clearCachedOperationsIdentity();
    Object.assign(adminImportAuthState, {
      loading: false,
      loaded: true,
      user: null,
      profile: null,
      message: storedSession?.access_token
        ? "운영 권한을 확인하지 못했습니다. 다시 확인해 주세요."
        : "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
    });
    renderOperationsLoginGate();
    return false;
  } finally {
    renderDataTools();
  }
}

async function refreshAdminPendingUsers() {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: [],
      message: "Supabase 연결값을 먼저 설정해야 신규 가입자를 확인할 수 있습니다.",
    });
    renderAdminPendingUsers();
    return;
  }
  if (!client.getSession?.()?.access_token) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: [],
      message: "관리자 로그인 후 신규 가입자를 확인할 수 있습니다.",
    });
    renderAdminPendingUsers();
    return;
  }
  if (adminImportAuthState.profile?.role !== "admin") {
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: [],
      message: "관리자 권한 계정으로 로그인해야 승인 처리가 가능합니다.",
    });
    renderAdminPendingUsers();
    return;
  }

  Object.assign(adminPendingUsersState, {
    loading: true,
    loaded: true,
    message: "신규 가입자 확인 중입니다.",
  });
  renderAdminPendingUsers();

  try {
    const result = await client.invokeFunction("tennisnote-admin-users", {
      body: { action: "list_pending" },
    });
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: Array.isArray(result.users) ? result.users : [],
      message: "신규 가입자 확인 완료",
    });
  } catch (error) {
    Object.assign(adminPendingUsersState, {
      loading: false,
      loaded: true,
      items: [],
      message: `신규 가입자 확인 실패: ${error?.payload?.code || error?.message || "server_error"}`,
    });
  }
  renderAdminPendingUsers();
}

async function previewDataImportOnServer() {
  if (dataImportState.status !== "ready") {
    showToast("오류 없는 파일만 서버 검증할 수 있습니다.");
    return;
  }
  if (!hasDataImportPayload()) {
    showToast("서버로 보낼 업로드 데이터가 없습니다.");
    return;
  }

  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction) {
    blockServerPreview("서버 검증 연결 코드가 아직 준비되지 않았습니다.");
    return;
  }
  if (!client.readiness?.().ready) {
    blockServerPreview("Supabase 연결값을 먼저 설정해야 서버 검증이 가능합니다.");
    return;
  }
  if (!client.getSession?.()?.access_token) {
    blockServerPreview("관리자 로그인 후 서버 검증을 실행할 수 있습니다.");
    return;
  }

  setDataImportState({
    serverStatus: "checking",
    serverMessage: "서버에서 관리자 권한과 업로드 행을 다시 검증하는 중입니다.",
    serverPreview: null,
  });

  try {
    const response = await client.invokeFunction("tennisnote-admin-import", {
      headers: { "x-tennisnote-import-mode": "preview" },
      body: dataImportRequestBody("preview"),
    });
    const summary = response.summary || {};
    const status = serverPreviewStatus(summary);
    setDataImportState({
      serverStatus: status,
      serverMessage: serverPreviewMessage(status, summary),
      serverPreview: summary,
    });
    showToast(status === "ready" ? "서버 검증 완료" : "서버 검증 결과 확인 필요");
  } catch (error) {
    const payload = error.payload || {};
    const message = payload.code === "missing_admin_token" || error.status === 401
      ? "관리자 로그인 정보가 필요합니다."
      : payload.code === "admin_role_required" || error.status === 403
        ? "관리자 권한 계정만 서버 검증할 수 있습니다."
        : payload.code || error.message || "서버 검증에 실패했습니다.";
    setDataImportState({
      serverStatus: "error",
      serverMessage: message,
      serverPreview: payload.summary || null,
    });
    showToast("서버 검증 실패");
  }
}

async function loadAdminDriveReportSnapshot({ force = false } = {}) {
  state.managementReportMonth = /^\d{4}-\d{2}$/.test(state.managementReportMonth)
    ? state.managementReportMonth
    : adminLocalDateKey(new Date()).slice(0, 7);
  const period = state.managementReportMonth;
  const branchId = activeOperationBranchId();
  const currentKey = `${branchId}:${period}`;
  const loadedKey = `${adminDriveReportState.branchId}:${adminDriveReportState.period}`;

  if (adminDemoMode) {
    Object.assign(adminDriveReportState, {
      loading: false,
      loaded: true,
      status: "not_configured",
      period,
      branchId,
      snapshot: null,
      message: "데모에서는 Drive 서버를 호출하지 않습니다.",
    });
    return false;
  }
  if (!force && adminDriveReportState.loaded && currentKey === loadedKey) return false;
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.readiness?.().ready || operationsRole() !== "admin" || !branchId) {
    Object.assign(adminDriveReportState, {
      loading: false,
      loaded: true,
      status: "not_configured",
      period,
      branchId,
      snapshot: null,
      message: "관리자 로그인과 현재 지점 연결을 확인해 주세요.",
    });
    if (state.view === "reports") renderReports();
    return false;
  }

  const requestSerial = ++adminDriveReportRequestSerial;
  Object.assign(adminDriveReportState, {
    loading: true,
    loaded: false,
    status: "loading",
    period,
    branchId,
    snapshot: null,
    message: "Drive 집계 셀 확인 중",
  });
  if (state.view === "reports") renderReports();
  try {
    const response = await client.invokeFunction("tennisnote-drive-report-snapshot", {
      body: { period, branchId },
    });
    if (requestSerial !== adminDriveReportRequestSerial) return false;
    const status = ["fresh", "stale", "provisional"].includes(response?.status)
      ? response.status
      : "error";
    Object.assign(adminDriveReportState, {
      loading: false,
      loaded: true,
      status,
      snapshot: response?.ok ? response : null,
      message: response?.ok ? "Drive 읽기 전용 집계 확인 완료" : "Drive 응답 계약을 확인해 주세요.",
    });
    return true;
  } catch (error) {
    if (requestSerial !== adminDriveReportRequestSerial) return false;
    Object.assign(adminDriveReportState, {
      loading: false,
      loaded: true,
      snapshot: null,
      ...adminDriveReportErrorState(error),
    });
    return true;
  } finally {
    if (requestSerial === adminDriveReportRequestSerial && state.view === "reports") renderReports();
  }
}

async function previewCoachLaneOrder() {
  const client = window.TennisNoteDataClient;
  const branchId = activeOperationBranchId();
  if (!client?.rpc || !branchId || operationsRole() !== "admin") return;
  coachLaneOrderEditorState.loading = true;
  coachLaneOrderEditorState.message = "서버의 현재 순서를 확인하는 중입니다.";
  renderCoachLaneOrderEditor();
  try {
    const preview = await client.rpc("tn_admin_preview_coach_schedule_lane_order", {
      target_branch_id: branchId,
      target_role_ids: coachLaneOrderEditorState.roleIds,
    });
    coachLaneOrderEditorState.revision = String(preview?.revision || "");
    coachLaneOrderEditorState.confirmed = Boolean(coachLaneOrderEditorState.revision);
    coachLaneOrderEditorState.message = preview?.changed
      ? "서버 확인 완료. 순서 저장을 누르면 모든 시간표에 적용됩니다."
      : "현재 서버 순서와 같습니다.";
  } catch (error) {
    coachLaneOrderEditorState.confirmed = false;
    coachLaneOrderEditorState.message = /tn_admin_preview_coach_schedule_lane_order|PGRST202|42883|schema cache/i.test(`${error?.message || ""} ${error?.payload?.message || ""}`)
      ? "시간표 열 순서 DB 기능을 먼저 적용해주세요."
      : `서버 확인 실패: ${error?.payload?.code || error?.message || "server_error"}`;
  } finally {
    coachLaneOrderEditorState.loading = false;
    renderCoachLaneOrderEditor();
  }
}

async function loadSupabasePublicSummary(client) {
  try {
    const rows = await client.selectRows(supabasePublicSummaryTable, {
      select: "key,label,table_name,row_count,status,detail,updated_at",
      limit: 50,
    });
    return rows
      .slice()
      .sort((left, right) => `${left.key}`.localeCompare(`${right.key}`))
      .map((row) => ({
        id: row.key,
        table: row.table_name,
        title: row.label,
        count: Number(row.row_count) || 0,
        status: row.status || "ready",
        label: `${Number(row.row_count) || 0}건`,
        detail: row.detail || "공개 가능한 샘플 상태 요약입니다.",
        publicSummary: true,
      }));
  } catch (error) {
    return [];
  }
}

async function loadSupabaseLiveStatus() {
  const client = window.TennisNoteDataClient;
  const target = $("#supabaseLiveStatus");
  if (!client || !target) return;

  const readiness = client.readiness();
  if (!readiness.ready) {
    supabaseLiveState.loaded = true;
    supabaseLiveState.loading = false;
    supabaseLiveState.message = "로컬 브라우저 설정이 아직 없습니다.";
    supabaseLiveState.items = supabaseLiveTables.map((item) => ({ ...item, title: item.label, status: "setup", label: "설정 필요", detail: "config.local.js 또는 localStorage 연결값 필요" }));
    renderSupabaseLiveStatus();
    return;
  }

  supabaseLiveState.loading = true;
  supabaseLiveState.message = "Supabase 읽기 확인 중";
  renderSupabaseLiveStatus();

  const summaryItems = await loadSupabasePublicSummary(client);
  const items = await Promise.all(
    supabaseLiveTables.map(async (item) => {
      try {
        const count = await client.countRows(item.table);
        return {
          ...item,
          title: item.label,
          count,
          status: count > 0 ? "ready" : "empty",
          label: count > 0 ? `${count}건` : "0건",
          detail: count > 0 ? "읽기 연결 확인" : "테이블은 연결됐고 아직 데이터가 없습니다.",
        };
      } catch (error) {
        return {
          ...item,
          status: "blocked",
          label: permissionMessage(error),
          detail: item.private ? "RLS 정책상 로그인/역할 연결 후 읽을 수 있습니다." : "설정 또는 권한을 확인해야 합니다.",
        };
      }
    }),
  );

  supabaseLiveState.loading = false;
  supabaseLiveState.loaded = true;
  if (summaryItems.length) {
    const summaryByTable = new Map(summaryItems.map((item) => [item.table, item]));
    const liveByTable = new Map(items.map((item) => [item.table, item]));
    const configuredItems = supabaseLiveTables.map((item) => summaryByTable.get(item.table) || liveByTable.get(item.table) || { ...item, title: item.label, status: "setup", label: "확인 전", detail: "직접 읽기 확인이 필요합니다." });
    const extraSummaryItems = summaryItems.filter((item) => !supabaseLiveTables.some((configured) => configured.table === item.table));
    supabaseLiveState.items = [...configuredItems, ...extraSummaryItems];
    supabaseLiveState.message = "Supabase 샘플 요약 + 신규 테이블 직접 확인 완료";
  } else {
    supabaseLiveState.items = items;
    supabaseLiveState.message = "Supabase 읽기 확인 완료";
  }
  renderSupabaseLiveStatus();
}

async function uploadNoticeDraftImage(notice) {
  if (!noticeImageDraftFile) return { notice, uploadedPath: "" };
  const client = liveNoticeClient();
  if (!client?.uploadObject) throw new Error("관리자 로그인 후 이미지를 첨부할 수 있습니다");
  const current = await client.selectCurrentProfile?.();
  const authUser = current?.user || await client.getAuthUser?.();
  const ownerId = current?.profile?.id || authUser?.id;
  if (!ownerId) throw new Error("관리자 계정을 확인할 수 없습니다");
  const objectPath = `${ownerId}/${safeNoticeFileName(noticeImageDraftFile.name)}`;
  await client.uploadObject(noticeMediaBucket, objectPath, noticeImageDraftFile);
  const imageUrl = noticeStoragePublicUrl(objectPath);
  if (!imageUrl) {
    await client.deleteObject?.(noticeMediaBucket, objectPath).catch(() => {});
    throw new Error("공지 이미지 주소를 만들 수 없습니다");
  }
  return {
    notice: normalizePopupNotice({ ...notice, imageUrl, imageStoragePath: objectPath }),
    uploadedPath: objectPath,
  };
}

async function checkAccountDeletionServerReadiness({ force = false } = {}) {
  const client = window.TennisNoteDataClient;
  if (!client?.invokeFunction || !client.getSession?.()?.access_token) {
    Object.assign(accountDeletionServerState, { status: "unauthorized", code: "login_required" });
    renderAccountDeletionServerStatus();
    renderAccountDeletionAdminList();
    return false;
  }
  if (!force && accountDeletionServerReady()) return true;
  if (accountDeletionServerState.status === "checking") return false;
  Object.assign(accountDeletionServerState, { status: "checking", code: "" });
  renderAccountDeletionServerStatus();
  renderAccountDeletionAdminList();
  try {
    const payload = await client.invokeFunction("tennisnote-account-deletion", {
      body: { action: "readiness" },
    });
    if (payload?.ok !== true || payload?.code !== "ready") throw new Error("account_deletion_readiness_invalid");
    Object.assign(accountDeletionServerState, {
      status: "ready",
      code: "ready",
      contractVersion: String(payload.contractVersion || ""),
      appleRevokeReady: payload.appleRevokeReady !== false,
      tokenEncryptionReady: payload.tokenEncryptionReady !== false,
    });
    return true;
  } catch (error) {
    const code = String(error?.payload?.code || error?.message || "").toLowerCase();
    const status = Number(error?.status) || 0;
    accountDeletionServerState.code = code || `http_${status || "unknown"}`;
    accountDeletionServerState.status = status === 404 || code.includes("function_not_found")
      ? "unavailable"
      : status === 401 || status === 403 || code.includes("login_required") || code.includes("admin_required")
        ? "unauthorized"
        : status === 503 || code.includes("server_config")
          ? "misconfigured"
          : code.includes("db_contract")
            ? "contract_error"
            : "error";
    return false;
  } finally {
    renderAccountDeletionServerStatus();
    renderAccountDeletionAdminList();
  }
}
