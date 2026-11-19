const CACHE_NAME = "tennis-note-coach-mode-v584-r4-01f658a88968b11c-entry-4aced5016d566ea1-ui-7423d1e2d58a3c03-group-2727766cd3c5b148-past-scope-f888b98ccbf4";
const CACHE_PREFIX = "tennis-note-coach-mode-";
const APP_SHELL = [
  "./r4-ui-finish.css?v=7423d1e2d58a3c03",
  "./r4-ui-finish.js?v=7423d1e2d58a3c03",
  "../shared/tennisnote-r4-coach-entry.js?v=4aced5016d566ea1",
  "./data/r4-workflows.js?v=r4-entry-4aced5016d566ea1",
  "./data/r4-scoped-workspace.js?v=r4-entry-4aced5016d566ea1",
  "./r4-scoped-workspace.css?v=01f658a88968b11c",
  "./",
  "./index.html",
  "./styles.css?v=1.0.578",
  "../shared/tennisnote-app-common.js?v=1.0.578",
  "./settings.js?v=1.0.578",
  "./catalog.js?v=1.0.578",
  "./domain/values.js?v=1.0.578",
  "./domain/schedule.js?v=1.0.578",
  "./domain/policy.js?v=1.0.578",
  "./domain/coaches.js?v=1.0.578",
  "./domain/lessons.js?v=past-scope-f888b98ccbf4bdc7",
  "./domain/records.js?v=group-94fe09bb9370960d",
  "./domain/members.js?v=1.0.578",
  "./domain/schedule-v2.js?v=1.0.578",
  "./domain/notices.js?v=1.0.578",
  "./domain/curriculum.js?v=1.0.578",
  "./domain/settlement.js?v=1.0.578",
  "./domain/makeup.js?v=1.0.578",
  "./domain/shared-data.js?v=1.0.578",
  "./domain/tasks.js?v=1.0.578",
  "./views/home.js?v=1.0.578",
  "./views/schedule.js?v=group-19169b26c3df7197",
  "./views/members.js?v=1.0.578",
  "./views/records.js?v=1.0.578",
  "./views/curriculum.js?v=1.0.578",
  "./views/settlement.js?v=1.0.578",
  "./views/profile.js?v=1.0.578",
  "./events/account.js?v=1.0.578",
  "./events/delegated.js?v=past-scope-d1cc477882966a1d",
  "./data/auth.js?v=r4-entry-4aced5016d566ea1",
  "./data/sync.js?v=past-scope-039d3b99b12aa27d",
  "./data/push.js?v=1.0.578",
  "./data/records.js?v=group-412f4162d9809089",
  "./ui/sheet.js?v=1.0.578",
  "./ui/screens.js?v=past-scope-5db5c904177550f0",
  "./actions/records.js?v=group-c253c985210fffb4",
  "./actions/schedule.js?v=past-scope-17ecb6d27855e410",
  "./actions/profile.js?v=1.0.578",
  "./actions/session.js?v=1.0.578",
  "./storage.js?v=1.0.578",
  "./domain/common.js?v=1.0.578",
  "./views/common.js?v=1.0.578",
  "./forms/coaches.js?v=1.0.578",
  "./forms/common.js?v=1.0.578",
  "./ui/common.js?v=1.0.578",
  "./app.js?v=group-9f68309d585f2a5c",
  "./assets/app-icon.svg",
  "../release.json",
  "../shared/tennisnote-runtime-environment.js?v=1.0.578",
  "../shared/tennisnote-escape-html.js?v=1.0.578",
  "../shared/tennisnote-data-client.js?v=1.0.578",
  "../shared/tennisnote-schedule-revision.js?v=1.0.578",
  "../shared/tennisnote-schedule-lanes.js?v=1.0.578",
  "../shared/tennisnote-curriculum-catalog.js?v=notion-catalog-3",
  "../shared/tennisnote-curriculum-search.js?v=1.0.578",
  "../shared/tennisnote-release.js?v=1.0.578",
  "../shared/tennisnote-release-updater.js?v=1.0.578",
  "../shared/tennisnote-issue-reporter.js?v=issue-reporter-4",
  "../shared/tennisnote-issue-reporter.css?v=issue-reporter-4",
  "../shared/tennisnote-ui-language.js?v=1.0.578",
  "../shared/tennisnote-ticket-state.js?v=1.0.578",
  "../shared/tennisnote-settlement-adjustment.js?v=1.0.578",
  "../shared/tennisnote-mode-transition.js?v=1.0.578",
  "../shared/tennisnote-comment-draft.js?v=1.0.578",
  "../shared/tennisnote-input-guard.js?v=1.0.578",
  "../shared/tennisnote-ui-foundation.css?v=1.0.578",
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
