/* CUR05: existing member surface adapter; no endpoint, credentials, progress writes or polling. */
(function (root) {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const groups = Object.freeze([
    { id: "forehand", label: "포핸드", categories: ["포핸드"] },
    { id: "backhand", label: "백핸드", categories: ["백핸드"] },
    { id: "net", label: "발리·네트", categories: ["네트플레이"] },
    { id: "tactics", label: "게임 전술", categories: ["전술전환"] },
    { id: "foundation", label: "서브·풋워크", categories: ["풋워크", "서브", "기초"] },
  ].map(group => Object.freeze({ ...group, categories: Object.freeze(group.categories) })));
  function baseline(catalog) {
    return { aliases: clone(catalog.aliases || {}), lessons: Object.fromEntries((catalog.steps || []).map(step => [step.id, {
      notionPageId: String(step.notionPageId || "").replaceAll("-", ""), trackId: step.trackId,
      nextLessonId: step.nextLessonId || null, title: step.title, searchAliases: step.searchAliases || [],
    }])) };
  }
  function project(data, bundled) {
    if (!data?.lessons) return clone(data || bundled);
    // Only CUR04-validated content reaches this adapter. Preserve legacy IDs/aliases and track metadata.
    const byId = new Map(bundled.steps.map(step => [step.id, step]));
    const steps = data.lessons.map(lesson => ({ ...byId.get(lesson.lessonId), ...lesson, id: lesson.lessonId,
      focus: lesson.goal, guide: lesson.goal, checklist: lesson.selfChecks,
      mission: lesson.personalPractice, memberSummary: lesson.goal }));
    const projected = new Map(steps.map(step => [step.id, step]));
    return { ...clone(bundled), steps, fundamentals: (bundled.fundamentals || []).map(step => projected.get(step.id)),
      tracks: bundled.tracks.map(track => ({ ...track, lessons: track.lessons.map(step => projected.get(step.id)) })) };
  }
  function tracks(catalog) {
    const result = (catalog.tracks || []).map(track => ({ ...track,
      steps: track.lessons.map(step => ({ ...step, goal: step.goal || step.focus,
        practice: step.personalPractice || step.mission, completion: step.selfChecks || step.checklist })) }));
    if (catalog.fundamentals?.length) result.unshift({ id: "FOUNDATION", title: "기초 움직임과 서브", category: "기초", steps: catalog.fundamentals });
    return result;
  }
  function searchIds(catalog, query) {
    const aliases = Object.entries(catalog.aliases || {});
    const searchable = catalog.steps.map(step => ({ ...step, memberSummary: [step.memberSummary,
      ...(step.searchAliases || []), ...aliases.filter(([, id]) => id === step.id).map(([alias]) => alias)].join(" ") }));
    return new Set(root.TennisNoteCurriculumSearch.search(searchable, query, { limit: searchable.length }).map(hit => hit.step.id));
  }
  function seconds(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 86400 ? value : null;
    if (/^\d+$/.test(String(value))) return Number.isSafeInteger(Number(value)) ? Number(value) : null;
    const match = String(value).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return match && match[0] ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : null;
  }
  function resources(step) {
    const seen = new Set();
    return (step.resources || []).flatMap(resource => {
      let url;
      try { url = new URL(resource.url); } catch { return []; }
      if (url.protocol !== "https:" || url.username || url.password) return [];
      const start = seconds(resource.startSeconds ?? url.searchParams.get("start") ?? url.searchParams.get("t"));
      const end = seconds(resource.endSeconds ?? url.searchParams.get("end"));
      const title = String(resource.title || "수업 자료");
      const key = JSON.stringify([title, url.href, start, end]);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...resource, title, url: url.href, start, end,
        observation: String(resource.observation || resource.learningFocus || "") }];
    });
  }
  function create(options) {
    const bundled = clone(options.catalog);
    const proofExpiries = new Map();
    const verifier = options.readerOptions?.verifyManifest;
    const reader = root.TennisNoteCurriculumReader.create({ ...options.readerOptions,
      baseline: baseline(bundled), bundledCatalog: bundled,
      verifyManifest: async (raw, context) => {
        const stamp = epoch;
        const verdict = await verifier?.(raw, context);
        if (stamp === epoch && verdict?.trusted === true && verdict.scope === context.scope) {
          const expiresAt = Number(root.TennisNoteCurriculumContract.timestamp(context.manifest.expiresAt) / 1000n);
          // A merely attested candidate may subsequently fail body/order validation. It must not extend
          // a currently displayed proof. Renewed access requires a new verified member binding.
          proofExpiries.set(context.manifest.contentVersion, Math.min(proofExpiries.get(context.manifest.contentVersion) || Infinity, expiresAt));
        }
        return verdict;
      } });
    const clock = options.clock || Date.now;
    let owner = "", epoch = 0, binding = 0, timer = null, identity = "", projection = null, sessionUntil = 0;
    const changed = () => options.onCatalog?.(projection);
    function clear() {
      binding++; epoch++; owner = ""; identity = ""; projection = null;
      sessionUntil = 0; proofExpiries.clear();
      clearTimeout(timer); timer = null; reader.logout(); options.onClear?.();
    }
    function guardDeadline(snapshot) {
      if (identity.startsWith("validated-cache:") && snapshot.source !== "validated-cache") { clear(); return false; }
      const deadline = snapshot.source === "validated-cache" ? Math.min(sessionUntil, proofExpiries.get(snapshot.contentVersion) || 0) : sessionUntil;
      if (deadline <= clock()) { clear(); return false; }
      clearTimeout(timer); const stamp = epoch;
      timer = setTimeout(() => { if (stamp === epoch) clear(); }, Math.min(deadline - clock(), 2147483647));
      return true;
    }
    function consume(snapshot) {
      if (!snapshot.data) { if (owner || projection) clear(); return false; }
      if (!guardDeadline(snapshot)) return false;
      const next = snapshot.source + ":" + (snapshot.contentVersion || "bundled");
      if (next !== identity) { projection = project(snapshot.data, bundled); identity = next; changed(); }
      return true;
    }
    async function bindVerifiedProfile(current, session) {
      const { profile, user } = current || {};
      const expiresAt = Number(session?.expires_at);
      // Called only after selectCurrentProfile; token presence and client fallback roles are insufficient.
      if (current?.profileBootstrapError || !user?.id || !profile?.id || profile.role !== "member"
        || profile.status !== "active" || !Number.isFinite(expiresAt) || expiresAt <= clock()) { clear(); return false; }
      // No previous owner's copy may remain while asynchronous scoping is in progress.
      clear();
      const attempt = ++binding;
      const digest = await root.crypto.subtle.digest("SHA-256", new TextEncoder().encode("TN-CUR05-MEMBER\n" + user.id + "\n" + profile.id));
      if (attempt !== binding) return false;
      const scope = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
      if (owner && owner !== scope) { clear(); }
      owner = scope; sessionUntil = expiresAt;
      return consume(reader.setSession({ scope, authorized: true, expiresAt }));
    }
    function authorized() {
      const snapshot = reader.snapshot();
      if (!snapshot.data) { if (owner || projection) clear(); return false; }
      return guardDeadline(snapshot);
    }
    function activity(value) { return reader.setActivity(value); }
    async function enter() {
      if (!authorized()) return false;
      activity(options.activity?.() || {});
      const stamp = epoch;
      const snapshot = await reader.enter();
      if (stamp !== epoch) return false;
      // Busy response is kept by CUR04; consumer never replaces an open lesson/player.
      if (options.activity?.().lessonOpen || options.activity?.().videoPlaying) return authorized();
      return consume(snapshot);
    }
    return Object.freeze({ bindVerifiedProfile, clear, authorized, activity, enter,
      snapshot: () => ({ authorized: authorized(), source: reader.snapshot().source,
        status: reader.snapshot().status, updatePending: reader.snapshot().updatePending, contentVersion: reader.snapshot().contentVersion }),
      configuration: reader.configuration });
  }
  root.TennisNoteCurriculumUI = Object.freeze({ create, baseline, project, tracks, groups, searchIds, resources });
})(typeof window === "undefined" ? globalThis : window);
