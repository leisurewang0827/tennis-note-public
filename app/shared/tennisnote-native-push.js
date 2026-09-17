(function () {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform?.() || !capacitor?.registerPlugin) {
    window.TennisNoteNativePush = null;
    window.TennisNoteNativePushReadiness = async () => ({ ready: false, reason: "native_runtime_unavailable" });
    return;
  }
  const pushPlugin = capacitor.registerPlugin("PushNotifications", {});
  const runtimePlugin = capacitor.registerPlugin("TennisNoteNativeRuntime", {});

  async function permissionFallback(reason) {
    let permission = null;
    try {
      permission = await pushPlugin?.checkPermissions?.();
    } catch {
      permission = null;
    }
    const notificationDenied = permission?.receive === "denied";
    return {
      ready: notificationDenied,
      firebaseReady: false,
      reason,
      notificationsEnabled: !notificationDenied,
      runtimePermissionRequired: false,
    };
  }

  async function nativePushReadiness() {
    if (capacitor.getPlatform?.() !== "android") {
      return { ready: true, firebaseReady: true, reason: "not_android", notificationsEnabled: true, runtimePermissionRequired: false };
    }
    if (!runtimePlugin?.getPushReadiness) return permissionFallback("runtime_guard_unavailable");
    try {
      const result = await runtimePlugin.getPushReadiness();
      if (
        typeof result?.ready !== "boolean"
        || typeof result?.notificationsEnabled !== "boolean"
        || typeof result?.runtimePermissionRequired !== "boolean"
      ) {
        return permissionFallback("runtime_guard_invalid");
      }
      const firebaseReady = result?.ready === true;
      const notificationsEnabled = result?.notificationsEnabled !== false;
      const runtimePermissionRequired = result?.runtimePermissionRequired === true;
      const notificationDisabled = !notificationsEnabled && !runtimePermissionRequired;
      return {
        // Older bundled modular clients check `ready` before inspecting the OS
        // notification state. Let them reach the permission classification while
        // keeping the Firebase result separate for the registration guard below.
        ready: firebaseReady || notificationDisabled,
        firebaseReady,
        reason: firebaseReady ? "ready" : String(result?.reason || "firebase_not_ready"),
        notificationsEnabled,
        runtimePermissionRequired,
      };
    } catch {
      return permissionFallback("runtime_guard_failed");
    }
  }

  window.TennisNoteNativePushReadiness = nativePushReadiness;
  window.TennisNoteNativePush = new Proxy(pushPlugin, {
    get(target, property) {
      if (property === "checkPermissions") {
        return async (...args) => {
          const readiness = await nativePushReadiness();
          if (readiness.notificationsEnabled === false && readiness.runtimePermissionRequired !== true) {
            return { receive: "denied" };
          }
          return target.checkPermissions(...args);
        };
      }
      if (property === "register") {
        return async (...args) => {
          const readiness = await nativePushReadiness();
          if (readiness.notificationsEnabled === false && readiness.runtimePermissionRequired !== true) {
            const error = new Error("native_notifications_disabled");
            error.code = "notifications_disabled";
            throw error;
          }
          if (readiness.firebaseReady !== true) {
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
