/*
 * Service worker de Mayerbook : rend l'app installable et lui permet de
 * s'ouvrir même sans connexion (dernière version consultée).
 * Stratégie « réseau d'abord » : on sert toujours la version en ligne si
 * possible, la copie en cache seulement hors connexion.
 * Les appels à Supabase ne sont jamais mis en cache.
 */
const CACHE = 'mayerbook-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // Uniquement les fichiers de l'app (même origine, lecture)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // « no-cache » : le navigateur revérifie toujours auprès du serveur
  // (sinon GitHub Pages laisse une ancienne version jusqu'à 10 minutes)
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
