(function (global) {
  "use strict";

  const channelName = "tennis-note-schedule-revision-v1";
  const activeIntervalMs = 2_000;
  const fallbackIntervalMs = 30_000;
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(channelName) : null;
  const watchers = new Set();

  function normalizedBranchId(value) {
    return String(value || "").trim();
  }

  function broadcast(branchId) {
    const normalized = normalizedBranchId(branchId);
    if (!normalized) return;
    channel?.postMessage({ type: "schedule_changed", branchId: normalized, at: Date.now() });
  }

  function watch(options = {}) {
    let stopped = false;
    let timer = 0;
    let inFlight = false;
    let revision = null;
    let revisionBranchId = "";

    const readBranchId = () => normalizedBranchId(options.branchId?.() || options.branchId);
    const isActive = () => document.visibilityState !== "hidden" && options.active?.() !== false;
    const schedule = (delay = isActive() ? activeIntervalMs : fallbackIntervalMs) => {
      if (stopped) return;
      global.clearTimeout(timer);
      timer = global.setTimeout(() => void check(), delay);
    };

    async function check(force = false) {
      if (stopped || inFlight) return false;
      const branchId = readBranchId();
      const client = global.TennisNoteDataClient;
      if (!branchId || !client?.rpc || !client.getSession?.()?.access_token || (!force && document.hidden)) {
        schedule();
        return false;
      }
      inFlight = true;
      try {
        if (revisionBranchId !== branchId) {
          revisionBranchId = branchId;
          revision = null;
        }
        const result = await client.rpc("tn_schedule_revision_snapshot", {
          target_branch_id: branchId,
        });
        const nextRevision = Number(result?.revision);
        if (!Number.isFinite(nextRevision)) return false;
        if (revision === null) {
          revision = nextRevision;
          options.onReady?.(result);
          return true;
        }
        if (nextRevision !== revision) {
          const previousRevision = revision;
          revision = nextRevision;
          await options.onChange?.({ ...result, previousRevision });
        }
        return true;
      } catch (error) {
        options.onError?.(error);
        return false;
      } finally {
        inFlight = false;
        schedule();
      }
    }

    const onFocus = () => void check(true);
    const onVisibility = () => {
      if (!document.hidden) void check(true);
      else schedule(fallbackIntervalMs);
    };
    const onOnline = () => void check(true);
    const onBroadcast = (event) => {
      if (event?.data?.type !== "schedule_changed") return;
      if (normalizedBranchId(event.data.branchId) !== readBranchId()) return;
      void check(true);
    };

    global.addEventListener("focus", onFocus);
    global.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    channel?.addEventListener("message", onBroadcast);
    const watcher = {
      check: () => check(true),
      notifyLocal: () => {
        broadcast(readBranchId());
        return check(true);
      },
      stop: () => {
        stopped = true;
        global.clearTimeout(timer);
        global.removeEventListener("focus", onFocus);
        global.removeEventListener("online", onOnline);
        document.removeEventListener("visibilitychange", onVisibility);
        channel?.removeEventListener("message", onBroadcast);
        watchers.delete(watcher);
      },
    };
    watchers.add(watcher);
    schedule(0);
    return watcher;
  }

  global.TennisNoteScheduleRevision = Object.freeze({
    watch,
    notify: broadcast,
    stopAll() {
      [...watchers].forEach((watcher) => watcher.stop());
    },
  });
})(window);
