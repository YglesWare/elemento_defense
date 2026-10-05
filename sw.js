// Élémento Defense : mise en cache pour jouer sans internet.
// Stratégie : réponse immédiate depuis le cache, puis mise à jour en arrière-plan quand le réseau répond.
const CACHE = 'elemento-v69';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/storage.js', 'js/errors.js', 'js/i18n.js', 'js/data.js', 'js/draw.js', 'js/game.js', 'js/ui.js', 'js/net.js', 'js/multi.js', 'js/duel.js', 'js/music.js', 'js/guide.js', 'js/random.js', 'js/coop.js', 'js/mascot.js', 'js/intro.js', 'js/bonus.js', 'js/trophies.js', 'js/actions.js', 'js/vendor/supabase.js', 'js/cloud.js', 'js/parents.js', 'js/friends.js', 'js/online.js', 'js/emotes.js', 'js/news.js', 'js/quests.js', 'js/ranking.js', 'js/wardrobe.js', 'js/comfort.js', 'js/story.js',
  'js/vendor/qrcode.min.js', 'js/vendor/jsQR.js', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', ev => {
  // cache: 'reload' : on va chercher les fichiers sur le réseau, jamais dans le cache HTTP du navigateur (sinon une nouvelle version peut garder d'anciens fichiers)
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;
  ev.respondWith(caches.open(CACHE).then(async cache => {
    const key = sameOrigin && url.pathname.endsWith('/') ? new Request(url.origin + url.pathname) : req;
    const hit = await cache.match(key, { ignoreSearch: sameOrigin });
    const net = fetch(sameOrigin ? new Request(req, { cache: 'no-cache' }) : req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { ev.waitUntil(net); return hit; }
    const res = await net;
    return res || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }));
});
