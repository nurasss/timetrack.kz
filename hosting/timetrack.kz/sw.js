// TEMPORARY KILL-SWITCH SERVICE WORKER (v21)
// Раньше здесь был кэширующий PWA-воркер. Он застревал на старых устройствах
// и отдавал устаревшую закэшированную страницу (из-за чего планшеты показывали
// «Доступ запрещён» даже после деплоя новой версии).
//
// Этот воркер при активации удаляет ВСЕ кэши, снимает сам себя с регистрации
// и перезагружает открытые вкладки — после чего страница грузится напрямую из
// сети. tablet.html больше не регистрирует Service Worker, поэтому цикла не
// возникает: один раз почистились — и всё.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (e) {}
    try {
      await self.registration.unregister();
    } catch (e) {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    } catch (e) {}
  })());
});

// Никогда не отдаём из кэша — только сеть.
self.addEventListener('fetch', () => {});
