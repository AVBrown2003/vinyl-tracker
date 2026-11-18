// Online: always try the network (so data is fresh) and keep a copy.
// Offline: serve the last copy, marked with an x-from-cache header so the page can say so.
const CACHE = "vinyl-tracker-v3";
const SHELL = [
  "./", "index.html", "browse.html", "trends.html", "manifest.webmanifest",
  "assets/style.css", "assets/common.js", "assets/today.js", "assets/browse.js",
  "assets/trends.js", "assets/charts.js", "assets/icon-192.png", "assets/icon-512.png",
  "data/status.json", "data/history.csv",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: "no-cache" });   // skip the browser HTTP cache too
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (!hit) throw err;
      const headers = new Headers(hit.headers);
      headers.set("x-from-cache", "1");
      return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers });
    }
  })());
});
