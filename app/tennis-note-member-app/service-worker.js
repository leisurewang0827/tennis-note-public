const CACHE_NAME = "tennis-note-member-pwa-v447";
const CACHE_PREFIX = "tennis-note-member-pwa-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.0.398",
  "../shared/tennisnote-app-common.js?v=1.0.398",
  "./settings.js?v=1.0.398",
  "./catalog.js?v=1.0.398",
  "./domain/products.js?v=1.0.398",
  "./domain/identity.js?v=1.0.398",
  "./domain/journal.js?v=1.0.398",
  "./domain/curriculum.js?v=1.0.398",
  "./domain/payment.js?v=1.0.398",
  "./domain/purchase.js?v=1.0.398",
  "./domain/tickets.js?v=1.0.398",
  "./domain/policy.js?v=1.0.398",
  "./domain/lessons.js?v=1.0.398",
  "./domain/changes.js?v=1.0.398",
  "./domain/schedule.js?v=1.0.398",
  "./domain/coaches.js?v=1.0.398",
  "./domain/shared-data.js?v=1.0.398",
  "./domain/notices.js?v=1.0.398",
  "./domain/values.js?v=1.0.398",
  "./views/home.js?v=1.0.398",
  "./views/schedule.js?v=1.0.398",
  "./views/profile.js?v=1.0.398",
  "./views/tickets.js?v=1.0.398",
  "./views/products.js?v=1.0.398",
  "./views/journal.js?v=1.0.398",
  "./views/curriculum.js?v=1.0.398",
  "./views/requests.js?v=1.0.398",
  "./events/delegated.js?v=1.0.398",
  "./events/account.js?v=1.0.398",
  "./events/makeup.js?v=1.0.398",
  "./events/journal.js?v=1.0.398",
  "./events/profile.js?v=1.0.398",
  "./events/schedule.js?v=1.0.398",
  "./events/home.js?v=1.0.398",
  "./data/auth.js?v=1.0.398",
  "./data/sync.js?v=1.0.398",
  "./data/push.js?v=1.0.398",
  "./data/payment.js?v=1.0.398",
  "./data/journal.js?v=1.0.398",
  "./data/tickets.js?v=1.0.398",
  "./ui/sheet.js?v=1.0.398",
  "./ui/screens.js?v=1.0.398",
  "./storage.js?v=1.0.398",
  "./actions/requests.js?v=1.0.398",
  "./actions/enrollment.js?v=1.0.398",
  "./actions/profile.js?v=1.0.398",
  "./actions/journal.js?v=1.0.398",
  "./actions/payment.js?v=1.0.398",
  "./actions/session.js?v=1.0.398",
  "./domain/common.js?v=1.0.398",
  "./domain/members.js?v=1.0.398",
  "./views/common.js?v=1.0.398",
  "./forms/common.js?v=1.0.398",
  "./forms/members.js?v=1.0.398",
  "./forms/notices.js?v=1.0.398",
  "./forms/payment.js?v=1.0.398",
  "./forms/schedule.js?v=1.0.398",
  "./forms/tickets.js?v=1.0.398",
  "./ui/common.js?v=1.0.398",
  "./app.js?v=1.0.398",
  "./manifest.webmanifest",
  "./assets/brand/app-icon-180.png",
  "./assets/brand/app-icon-192.png",
  "./assets/brand/app-icon-512.png",
  "./assets/brand/launch-splash.png",
  "./assets/brand/tennis-note-share-1.0.152.png",
  "../release.json",
  "../shared/tennisnote-escape-html.js?v=1.0.398",
  "../shared/tennisnote-data-client.js?v=1.0.398",
  "../shared/tennisnote-schedule-revision.js?v=1.0.398",
  "../shared/tennisnote-schedule-lanes.js?v=1.0.398",
  "../shared/tennisnote-product-catalog.js?v=policy-catalog-2",
  "../shared/tennisnote-curriculum-catalog.js?v=notion-catalog-3",
  "../shared/tennisnote-native-push.js",
  "../shared/tennisnote-release.js?v=1.0.398",
  "../shared/tennisnote-release-updater.js?v=1.0.398",
  "../shared/tennisnote-issue-reporter.js?v=issue-reporter-4",
  "../shared/tennisnote-issue-reporter.css?v=issue-reporter-4",
  "../shared/tennisnote-ui-language.js?v=1.0.398",
  "../shared/tennisnote-ticket-state.js?v=1.0.398",
  "../shared/tennisnote-mode-transition.js?v=1.0.398",
  "../shared/tennisnote-bottom-sheet.js?v=bottom-sheet-2",
  "../shared/tennisnote-input-guard.js?v=1.0.398",
  "../shared/tennisnote-ui-foundation.css?v=1.0.398",
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
