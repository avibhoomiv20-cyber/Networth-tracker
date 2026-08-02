const CACHE = "assettracker-static-v4";
const STATIC = ["/manifest.webmanifest", "/favicon.svg", "/app-icon-192.png", "/app-icon-512.png", "/apple-touch-icon.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(Promise.all([
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  self.clients.claim(),
])));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Financial pages, Supabase requests and AI are deliberately never cached.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname === "/" || url.pathname.startsWith("/api")) return;
  if (/\.(?:js|css|svg|png|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response;
    })));
  }
});
