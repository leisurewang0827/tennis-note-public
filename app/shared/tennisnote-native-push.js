(function () {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform?.() || !capacitor?.registerPlugin) {
    window.TennisNoteNativePush = null;
    return;
  }
  window.TennisNoteNativePush = capacitor.registerPlugin("PushNotifications", {});
})();
