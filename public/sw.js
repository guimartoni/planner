/* Service worker do Planner: deixa o app abrir instantâneo e funcionar
   como aplicativo instalado. Navegação: rede primeiro (app sempre novo),
   com cache de reserva se estiver sem internet. Assets (com hash no nome):
   cache primeiro. Os dados em si moram no OneDrive — nada deles fica aqui. */
const CACHE = "planner-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request).then((m) => m || caches.match("/planner/")))
    );
    return;
  }

  if (url.pathname.includes("/assets/") || /\.(png|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((m) =>
        m || fetch(e.request).then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
      )
    );
  }
});
