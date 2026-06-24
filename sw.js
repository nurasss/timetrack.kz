const CACHE_NAME = 'timetrack-pwa-v15';
const STATIC_ASSETS = [
  './index.html',
  './admin.html',
  './tablet.html',
  './manifest.webmanifest',
  './icons/timetrack-192.png',
  './icons/timetrack-512.png',
  './models/face_landmark_68_tiny_model-weights_manifest.json',
  './models/face_landmark_68_tiny_model-shard1',
  './models/face_recognition_model-weights_manifest.json',
  './models/face_recognition_model-shard1',
  './models/face_recognition_model-shard2',
  './models/ssd_mobilenetv1_model-weights_manifest.json',
  './models/ssd_mobilenetv1_model-shard1',
  './models/ssd_mobilenetv1_model-shard2',
  './models/tiny_face_detector_model-weights_manifest.json',
  './models/tiny_face_detector_model-shard1'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/api.php')) return;
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./tablet.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cached) => cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }))
  );
});
