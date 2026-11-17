
const CACHE_NAME = "geomaster-v2-phase4";

// Find the project root dynamically.
// This also works when hosted on GitHub Pages
// inside a repository folder such as /GeoMaster/.
const BASE_URL = new URL("./", self.location.href);

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.webmanifest",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/images/earth.png",
    "./data/countries.json"
].map(path => new URL(path, BASE_URL).href);


// Install: cache the main application files.
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});


// Activate: remove old GeoMaster caches.
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name =>
                            name.startsWith("geomaster-") &&
                            name !== CACHE_NAME
                        )
                        .map(name => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});


// Fetch: handle local application files.
self.addEventListener("fetch", event => {
    const request = event.request;

    // Only handle GET requests.
    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Ignore external resources such as map tiles
    // and externally hosted flag images.
    if (url.origin !== self.location.origin) return;

    // Only handle files inside this GeoMaster installation.
    if (!url.href.startsWith(BASE_URL.href)) return;

    // HTML pages: network first, then cached version.
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, copy));
                    }

                    return response;
                })
                .catch(async () => {
                    return await caches.match(request) ||
                        await caches.match(
                            new URL("./index.html", BASE_URL).href
                        );
                })
        );

        return;
    }

    // Other local files: cache first, then network.
    event.respondWith(
        caches.match(request, { ignoreSearch: true })
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request).then(response => {
                    if (response.ok) {
                        const copy = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, copy));
                    }

                    return response;
                });
            })
    );
});
