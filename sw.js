/* CUSTSTEP ESG NETWORK — offline shell (Belle issaC scan v6b 동일 구조) */
const CACHE = 'custstep-esg-v1-261002';
const ASSETS = ['./', './index.html', './manifest.json', './privacy.html', './icon-192.png', './icon-180.png', './icon-512.png', './favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                      // 시트 저장·OCR(POST)은 절대 캐시하지 않음
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // 구글·폰트는 네트워크로
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;                                  // cache-first, 백그라운드 갱신
    })
  );
});
