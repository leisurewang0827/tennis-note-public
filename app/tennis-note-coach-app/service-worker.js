const CACHE_NAME = "tennis-note-coach-mode-v346";
const CACHE_PREFIX = "tennis-note-coach-mode-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.0.327",
  "./app.js?v=1.0.327",
  "./assets/app-icon.svg",
  "../release.json",
  "../shared/tennisnote-data-client.js?v=1.0.327",
  "../shared/tennisnote-schedule-revision.js?v=1.0.327",
  "../shared/tennisnote-schedule-lanes.js?v=1.0.327",
  "../shared/tennisnote-curriculum-catalog.js?v=notion-catalog-3",
  "../shared/tennisnote-release.js?v=1.0.327",
  "../shared/tennisnote-release-updater.js?v=1.0.327",
  "../shared/tennisnote-issue-reporter.js",
  "../shared/tennisnote-issue-reporter.css",
  "../shared/tennisnote-ui-language.js?v=1.0.327",
  "../shared/tennisnote-ticket-state.js?v=1.0.327",
  "../shared/tennisnote-comment-draft.js?v=1.0.327",
  "../shared/tennisnote-input-guard.js?v=1.0.327",
  "../shared/tennisnote-ui-foundation.css?v=1.0.327",
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
  event.waitUntil(deleteOldCaches());
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const networkFirst = event.request.mode === "navigate"
    || ["document", "script", "style", "manifest", "worker"].includes(event.request.destination)
    || url.pathname.endsWith("/config.local.js");

  event.respondWith(
    fetch(event.request, networkFirst ? { cache: "no-store" } : undefined)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.open(CACHE_NAME).then((cache) => cache.match(event.request));
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      }),
  );
});
