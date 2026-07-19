const CACHE_NAME = "tennis-note-coach-mode-v65";
const CACHE_PREFIX = "tennis-note-coach-mode-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.0.31",
  "./app.js?v=1.0.31",
  "./assets/app-icon.svg",
  "../shared/tennisnote-data-client.js?v=1.0.31",
  "../shared/tennisnote-curriculum-catalog.js",
  "../shared/tennisnote-release.js?v=1.0.31",
  "../shared/tennisnote-issue-reporter.js",
  "../shared/tennisnote-issue-reporter.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_SHELL.map((path) => cache.add(path).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const networkFirst = event.request.destination === "document" || url.pathname.endsWith("/config.local.js");
  const cacheFirst = ["script", "style", "worker"].includes(event.request.destination);

  if (cacheFirst) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      const update = fetch(event.request, { cache: "no-store" }).then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(update.catch(() => undefined));
        return cached;
      }
      return update;
    })());
    return;
  }

  event.respondWith(
    fetch(event.request, networkFirst ? { cache: "no-store" } : undefined)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
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
