(function () {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform?.() || !capacitor?.registerPlugin) {
    window.TennisNoteNativePush = null;
    window.TennisNoteNativePushReadiness = async () => ({ ready: false, reason: "native_runtime_unavailable" });
    return;
  }
  const pushPlugin = capacitor.registerPlugin("PushNotifications", {});
  const runtimePlugin = capacitor.registerPlugin("TennisNoteNativeRuntime", {});

  async function nativePushReadiness() {
    if (capacitor.getPlatform?.() !== "android") return { ready: true, reason: "not_android" };
    if (!runtimePlugin?.getPushReadiness) return { ready: false, reason: "runtime_guard_unavailable" };
    try {
      const result = await runtimePlugin.getPushReadiness();
      return result?.ready === true
        ? { ready: true, reason: "ready" }
        : { ready: false, reason: String(result?.reason || "firebase_not_ready") };
    } catch {
      return { ready: false, reason: "runtime_guard_failed" };
    }
  }

  window.TennisNoteNativePushReadiness = nativePushReadiness;
  window.TennisNoteNativePush = new Proxy(pushPlugin, {
    get(target, property) {
      if (property === "register") {
        return async (...args) => {
          const readiness = await nativePushReadiness();
          if (!readiness.ready) {
            const error = new Error("native_push_unavailable");
            error.code = readiness.reason;
            throw error;
          }
          return target.register(...args);
        };
      }
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
})();
