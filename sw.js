'use strict';
// Avelã Demo — guarda o jogo no telemóvel para jogar sem internet (versão e9190f8448)
const CACHE = 'avela-demo-e9190f8448';
const FILES = ["./","index.html","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png","js/audio.js","js/beach.js","js/config.js","js/entities.js","js/font.js","js/game.js","js/input.js","js/jungle.js","js/leaves.js","js/level.js","js/music.js","js/player.js","js/render.js","js/songs.js","js/sprites.js","js/temple.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
