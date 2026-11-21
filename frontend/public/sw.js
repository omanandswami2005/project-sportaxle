// Keeps photos and built assets on the device so the big screen survives patchy venue Wi-Fi.
// Serves from the cache first and refreshes it in the background. Never touches /api,
// the page itself or /media (video needs range requests).
const CACHE = "sportsaxle-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  if (!url.pathname.startsWith("/photos/") && !url.pathname.startsWith("/assets/")) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      const fresh = fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      });
      if (hit) {
        fresh.catch(() => {}); // refresh quietly; offline is fine
        return hit;
      }
      return fresh;
    }),
  );
});
