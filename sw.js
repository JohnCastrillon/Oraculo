// Nombre del caché local
const CACHE_NAME = 'oraculo-v2';

// Recursos esenciales que se guardan en el dispositivo
const STATIC_ASSETS = [
  './',
  'index.html',
  'dasboard.html',
  'movimiento.html',
  'css/styles.css',
  'js/app.js',
  'manifest.json'
];

// Instalación: precarga de interfaz
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activación: limpieza de cachés antiguas si se actualiza la versión
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Interceptor de red: sirve interfaz desde caché y datos de Sheets siempre en vivo
self.addEventListener('fetch', (event) => {
  // Las llamadas a Google Apps Script nunca se cachean para tener siempre datos frescos
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});