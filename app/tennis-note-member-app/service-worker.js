const CACHE_NAME = "tennis-note-member-pwa-v482";
const CACHE_PREFIX = "tennis-note-member-pwa-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.0.433",
  "../shared/tennisnote-app-common.js?v=1.0.433",
  "./settings.js?v=1.0.433",
  "./catalog.js?v=1.0.433",
  "./domain/products.js?v=1.0.433",
  "./domain/identity.js?v=1.0.433",
  "./domain/journal.js?v=1.0.433",
  "./domain/curriculum.js?v=1.0.433",
  "./domain/payment.js?v=1.0.433",
  "./domain/purchase.js?v=1.0.433",
  "./domain/tickets.js?v=1.0.433",
  "./domain/policy.js?v=1.0.433",
  "./domain/lessons.js?v=1.0.433",
  "./domain/changes.js?v=1.0.433",
  "./domain/schedule.js?v=1.0.433",
  "./domain/coaches.js?v=1.0.433",
  "./domain/shared-data.js?v=1.0.433",
  "./domain/notices.js?v=1.0.433",
  "./domain/values.js?v=1.0.433",
  "./domain/onboarding.js?v=1.0.433",
  "./views/home.js?v=1.0.433",
  "./views/schedule.js?v=1.0.433",
  "./views/profile.js?v=1.0.433",
  "./views/tickets.js?v=1.0.433",
  "./views/products.js?v=1.0.433",
  "./views/journal.js?v=1.0.433",
  "./views/curriculum.js?v=1.0.433",
  "./views/requests.js?v=1.0.433",
  "./views/onboarding.js?v=1.0.433",
  "./events/delegated.js?v=1.0.433",
  "./events/account.js?v=1.0.433",
  "./events/makeup.js?v=1.0.433",
  "./events/journal.js?v=1.0.433",
  "./events/profile.js?v=1.0.433",
  "./events/schedule.js?v=1.0.433",
  "./events/home.js?v=1.0.433",
  "./data/auth.js?v=1.0.433",
  "./data/sync.js?v=1.0.433",
  "./data/push.js?v=1.0.433",
  "./data/payment.js?v=1.0.433",
  "./data/journal.js?v=1.0.433",
  "./data/tickets.js?v=1.0.433",
  "./data/onboarding.js?v=1.0.433",
  "./ui/sheet.js?v=1.0.433",
  "./ui/screens.js?v=1.0.433",
  "./storage.js?v=1.0.433",
  "./actions/requests.js?v=1.0.433",
  "./actions/enrollment.js?v=1.0.433",
  "./actions/profile.js?v=1.0.433",
  "./actions/journal.js?v=1.0.433",
  "./actions/payment.js?v=1.0.433",
  "./actions/session.js?v=1.0.433",
  "./actions/onboarding.js?v=1.0.433",
  "./domain/common.js?v=1.0.433",
  "./domain/members.js?v=1.0.433",
  "./views/common.js?v=1.0.433",
  "./forms/common.js?v=1.0.433",
  "./forms/members.js?v=1.0.433",
  "./forms/notices.js?v=1.0.433",
  "./forms/payment.js?v=1.0.433",
  "./forms/schedule.js?v=1.0.433",
  "./forms/tickets.js?v=1.0.433",
  "./ui/common.js?v=1.0.433",
  "./app.js?v=1.0.433",
  "./manifest.webmanifest",
  "./assets/brand/app-icon-180.png",
  "./assets/brand/app-icon-192.png",
  "./assets/brand/app-icon-512.png",
  "./assets/brand/launch-splash.png",
  "./assets/brand/tennis-note-share-1.0.152.png",
  "../release.json",
  "../shared/tennisnote-escape-html.js?v=1.0.433",
  "../shared/tennisnote-data-client.js?v=1.0.433",
  "../shared/tennisnote-schedule-revision.js?v=1.0.433",
  "../shared/tennisnote-schedule-lanes.js?v=1.0.433",
  "../shared/tennisnote-product-catalog.js?v=policy-catalog-2",
  "../shared/tennisnote-curriculum-catalog.js?v=notion-catalog-3",
  "../shared/tennisnote-native-push.js",
  "../shared/tennisnote-release.js?v=1.0.433",
  "../shared/tennisnote-release-updater.js?v=1.0.433",
  "../shared/tennisnote-issue-reporter.js?v=issue-reporter-4",
  "../shared/tennisnote-issue-reporter.css?v=issue-reporter-4",
  "../shared/tennisnote-ui-language.js?v=1.0.433",
  "../shared/tennisnote-ticket-state.js?v=1.0.433",
  "../shared/tennisnote-mode-transition.js?v=1.0.433",
  "../shared/tennisnote-bottom-sheet.js?v=bottom-sheet-2",
  "../shared/tennisnote-input-guard.js?v=1.0.433",
  "../shared/tennisnote-ui-foundation.css?v=1.0.433",
  "../shared/tennisnote-bottom-sheet.css?v=bottom-sheet-2",
];

function deleteOldCaches() {
  return caches.keys().then((keys) =>
    Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      deleteOldCaches(),
      caches.open(CACHE_NAME).then((cache) =>
        Promise.all(APP_SHELL.map((path) => cache.add(path).catch(() => undefined))),
      ),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([deleteOldCaches(), self.clients.claim()]));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Same-script re-registration can skip install/activate, so navigation also
  // removes only obsolete app caches without touching login or local data.
  if (event.request.mode === "navigate") event.waitUntil(deleteOldCaches());

  const isReleaseManifest = url.pathname.endsWith("/release.json");
  const cacheKey = isReleaseManifest ? `${url.origin}${url.pathname}` : event.request;
  const networkFirst = event.request.mode === "navigate"
    || ["document", "script", "style", "manifest", "worker"].includes(event.request.destination)
    || url.pathname.endsWith("/config.local.js")
    || isReleaseManifest;

  event.respondWith(
    fetch(event.request, networkFirst ? { cache: "no-store" } : undefined)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy)).catch(() => undefined));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.open(CACHE_NAME).then((cache) => cache.match(cacheKey, isReleaseManifest ? { ignoreSearch: true } : undefined));
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      }),
  );
});
