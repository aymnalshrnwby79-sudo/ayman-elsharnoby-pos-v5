/* ==========================================
   Safe Service Worker Patch (v5.0 - Production)
   ========================================== */

const CACHE_NAME = 'gold-pos-cache-v5';
const REQUIRED_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './storage.js',
  './invoice.js',
  './settings.js',
  './manifest.json'
];

// Install Event - Clean & Safe Pre-caching
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // نفحص الملفات ملف ملف عشان لو ملف ناقص ميبوظش الدنيا
      return Promise.all(
        REQUIRED_ASSETS.map((asset) => {
          return cache.add(asset).catch((err) => {
            console.warn(`[SW] Skip missing asset: ${asset}`, err);
          });
        })
      );
    })
  );
});

// Activate Event - Clean old caches safely
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // السيطرة الآمنة بعد التنظيف
  );
});

// Fetch Event - Network First for HTML, Stale-While-Revalidate for Assets
self.addEventListener('fetch', (event) => {
  // تجاهل أي روابط خارجية عشان متعملش قفلة
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // استراتيجية الصفحة الرئيسية: اسأل النت الأول
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request)) // لو مفيش نت هات الكاش
    );
    return;
  }

  // باقي الملفات (أكواد وصور): شغل الكاش وفي نفس الوقت حدثه من الظهر
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || networkFetch;
    })
  );
});