/* Rota service worker — uygulama kabuğu önbelleği + güvenli strateji.
   - Sayfa gezintisi: network-first (yeni deploy hemen görünür), çevrimdışıysa önbellekteki kabuk.
   - Hash'li statik varlıklar (/assets/*, font, görsel): cache-first (içerik hash'i sabit).
   - Üçüncü taraf (Supabase, Google, iyzico, fontlar): araya GİRİLMEZ, doğrudan ağ. */
const CACHE = 'rota-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }

  // Sadece kendi origin'imiz; API ve 3. taraf istekleri dokunmadan geçsin
  if (url.origin !== self.location.origin) return;

  // SPA gezintisi → network-first, çevrimdışıysa kabuk
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req)))
    );
    return;
  }

  // Hash'li statik varlıklar → cache-first
  if (url.pathname.startsWith('/assets/') || /\.(png|jpg|jpeg|svg|webp|woff2?|ttf|css|js)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        });
      })
    );
  }
});
