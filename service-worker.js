// GeoMaster v2.0 release candidate – versioned offline shell.
// Changing CACHE_NAME is required when publishing a new app version.
const CACHE_NAME = "geomaster-v2-rc1";
const BASE_URL = new URL("./", self.location.href);
const APP_FILES = [
  "./", "./index.html", "./style.css", "./script.js",
  "./manifest.webmanifest", "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png", "./assets/images/earth.png",
  "./data/countries.json"
].map(path => new URL(path, BASE_URL).href);

// Precache local files, but let an existing user finish their game.
// New workers wait until the user selects 'Oppdater'.
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
});
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith("geomaster-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE_URL.href)) return;

  // App's HTML, JS, CSS and country database: network-first, cached fallback.
  // Avoid serving an old script with a newer HTML page on an online launch.
  const updateSensitive = request.mode === "navigate" ||
    [".js", ".css", ".json", ".webmanifest"].some(ext => url.pathname.endsWith(ext));
  if (updateSensitive) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
        }
        return response;
      }).catch(async () =>
        (await caches.match(request)) ||
        (request.mode === "navigate" ? caches.match(new URL("./index.html", BASE_URL).href) : Response.error())
      )
    );
    return;
  }

  // Images and icons: fast cached version, network as fallback.
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return response;
    }))
  );
});
