const CACHE = 'pvg-v9';
const STATIC = ['./manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // NEVER cache Google Scripts or APIs
  if (url.includes('script.google.com') || url.includes('googleapis.com') || url.includes('?')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status: 408})));
    return;
  }

  // HTML files: always network-first so updates are seen immediately.
  //
  // A mudança em relação ao pvg-v8: a requisição é remontada com
  // cache:'reload'. Antes, "fetch(e.request)" ia à rede mas ainda passava pelo
  // cache HTTP do navegador, que podia devolver a cópia anterior por alguns
  // minutos depois de uma publicação. Com a verificação de versão do V153 isso
  // virava um problema visível: o app enxergava a versão nova (consulta com
  // ?_v= e no-store, que não passa por cache nenhum), recarregava, recebia o
  // arquivo velho de volta e detectava a versão nova outra vez.
  //
  // "cache:'reload'" obriga a ida ao servidor e ignora qualquer cópia local.
  // O cache continua sendo alimentado logo abaixo, então o funcionamento
  // offline não muda.
  if (e.request.destination === 'document' || url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' })).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets (icons, manifest): cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
