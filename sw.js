const VERSION = "1.0.0";
const CACHE_NAME = "samat-chat" + VERSION;

console.log("ABC");

async function installCache(ev) {
    const cache = await caches.open(CACHE_NAME);

    await cache.addAll([
        "/",
        "/404.html",
        "/script/main.js",
        "/script/misc.js",
        "/style/style.css",
        "/style/global.css",
    ]);
}

async function onActivate(ev) {
    await self.clients.claim();

    for (const key of await caches.keys()) {
        // Delete outdated cache
        if (!key.includes(VERSION)) await caches.delete(key);
    }
}

function onFetch(ev) {
    const { request: req } = ev;

    if (req.method !== "GET") return;

    // This should filter out API requests?
    if (req.url.includes("/rest/") || req.url.includes("/auth/")) return;

    // Navigation is network-first
    if (req.mode === "navigate") {
        return ev.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);

                try {
                    const response = await fetch(req);
                    if (response.ok) cache.put(req, response.clone());
                    return response;
                } catch (err) {
                    // TODO: any other error could happen???
                    const cached = await cache.match(req);
                    if (cached) return cached;
                    // TODO: what to do here???
                }
            })()
        );
    }

    // Static assets are cache first
    if (["style", "script", "image"].includes(req.destination)) {
        return ev.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);

                const cached = await cache.match(req);
                if (cached) return cached;

                const response = await fetch(req);
                cache.put(req, response.clone());
                return response;
            })()
        );
    }
}

self.addEventListener("install", (ev) => {
    self.skipWaiting();
    ev.waitUntil(installCache(ev));
});

self.addEventListener("activate", (ev) => ev.waitUntil(onActivate(ev)));
self.addEventListener("fetch", (ev) => onFetch(ev));
