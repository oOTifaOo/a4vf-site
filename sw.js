/* Service worker của A4VFamily. Trang và dữ liệu luôn ưu tiên mạng để không hiện bản cũ;
   chỉ dùng bản đã lưu khi mất mạng. File có ?v= không đổi nội dung nên lấy từ bộ nhớ trước. */

const VERSION = '__VERSION__';
const CACHE = `a4vf-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

const store = async (request, response) => {
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
};

async function networkFirst(request, fallback) {
  try {
    return await store(request, await fetch(request));
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true }) ?? (fallback && await caches.match(fallback));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  return await caches.match(request) ?? store(request, await fetch(request));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') event.respondWith(networkFirst(request, '/'));
  else if (url.pathname === '/sw.js') return;
  else if (url.search.startsWith('?v=') && /\.(css|js)$/.test(url.pathname) && !/\/data\.js$/.test(url.pathname)) event.respondWith(cacheFirst(request));
  else if (/\.(js|json|css|png|webp|ico|webmanifest)$/.test(url.pathname)) event.respondWith(networkFirst(request));
});
