const CACHE_NAME = "tennis-note-coach-mode-v478";
const CACHE_PREFIX = "tennis-note-coach-mode-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.0.456",
  "../shared/tennisnote-app-common.js?v=1.0.456",
  "./settings.js?v=1.0.456",
  "./catalog.js?v=1.0.456",
  "./domain/values.js?v=1.0.456",
  "./domain/schedule.js?v=1.0.456",
  "./domain/policy.js?v=1.0.456",
  "./domain/coaches.js?v=1.0.456",
  "./domain/lessons.js?v=1.0.456",
  "./domain/records.js?v=1.0.456",
  "./domain/members.js?v=1.0.456",
  "./domain/schedule-v2.js?v=1.0.456",
  "./domain/notices.js?v=1.0.456",
  "./domain/curriculum.js?v=1.0.456",
  "./domain/settlement.js?v=1.0.456",
  "./domain/makeup.js?v=1.0.456",
  "./domain/shared-data.js?v=1.0.456",
  "./domain/tasks.js?v=1.0.456",
  "./views/home.js?v=1.0.456",
  "./views/schedule.js?v=1.0.456",
  "./views/members.js?v=1.0.456",
  "./views/records.js?v=1.0.456",
  "./views/curriculum.js?v=1.0.456",
  "./views/settlement.js?v=1.0.456",
  "./views/profile.js?v=1.0.456",
  "./events/account.js?v=1.0.456",
  "./events/delegated.js?v=1.0.456",
  "./data/auth.js?v=1.0.456",
  "./data/sync.js?v=1.0.456",
  "./data/push.js?v=1.0.456",
  "./data/records.js?v=1.0.456",
  "./ui/sheet.js?v=1.0.456",
  "./ui/screens.js?v=1.0.456",
  "./actions/records.js?v=1.0.456",
  "./actions/schedule.js?v=1.0.456",
  "./actions/profile.js?v=1.0.456",
  "./actions/session.js?v=1.0.456",
  "./storage.js?v=1.0.456",
  "./domain/common.js?v=1.0.456",
  "./views/common.js?v=1.0.456",
  "./forms/coaches.js?v=1.0.456",
  "./forms/common.js?v=1.0.456",
  "./ui/common.js?v=1.0.456",
  "./app.js?v=1.0.456",
  "./assets/app-icon.svg",
  "../release.json",
  "../shared/tennisnote-escape-html.js?v=1.0.456",
  "../shared/tennisnote-data-client.js?v=1.0.456",
  "../shared/tennisnote-schedule-revision.js?v=1.0.456",
  "../shared/tennisnote-schedule-lanes.js?v=1.0.456",
  "../shared/tennisnote-curriculum-catalog.js?v=notion-catalog-3",
  "../shared/tennisnote-curriculum-search.js?v=1.0.456",
  "../shared/tennisnote-release.js?v=1.0.456",
  "../shared/tennisnote-release-updater.js?v=1.0.456",
  "../shared/tennisnote-issue-reporter.js?v=issue-reporter-4",
  "../shared/tennisnote-issue-reporter.css?v=issue-reporter-4",
  "../shared/tennisnote-ui-language.js?v=1.0.456",
  "../shared/tennisnote-ticket-state.js?v=1.0.456",
  "../shared/tennisnote-mode-transition.js?v=1.0.456",
  "../shared/tennisnote-comment-draft.js?v=1.0.456",
  "../shared/tennisnote-input-guard.js?v=1.0.456",
  "../shared/tennisnote-ui-foundation.css?v=1.0.456",
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
