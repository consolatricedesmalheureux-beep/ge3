/* ═══════════════════════════════════════════════════════════════════════════
   GE 3.0 — Service worker.

   Le cahier des charges (§7.2) fait du fonctionnement hors connexion une
   exigence déterminante : « de nombreuses écoles ne disposent pas d'une
   connexion permanente, et l'outil doit demeurer utilisable dans ces
   conditions ». Il précise aussi que les éditions PDF et les exports Excel
   doivent rester disponibles hors ligne.

   Deux stratégies en découlent :

   — Le noyau de l'application (page, scripts, manifeste) est mis en cache à
     l'installation et servi depuis le cache en priorité. L'application
     s'ouvre donc sans réseau.

   — Les bibliothèques externes qui produisent les documents (jsPDF est déjà
     intégré au fichier, mais XLSX, html2canvas et QRCode viennent de CDN)
     sont mises en cache à la première utilisation. Sans cela, les exports
     Excel échoueraient hors ligne, ce que le §7.2 interdit explicitement.

   Les appels à l'API Supabase ne sont jamais mis en cache : servir une
   donnée périmée serait pire que l'absence de réponse. La file d'attente
   locale prend le relais quand le réseau manque.
   ═══════════════════════════════════════════════════════════════════════════ */

const VERSION = 'ge3-v1';
const CACHE_NOYAU = VERSION + '-noyau';
const CACHE_LIBS = VERSION + '-libs';

const NOYAU = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/ge3-backend.js',
  './assets/ge3-saisie-cloud.js',
  './assets/ge3-droits.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NOYAU)
      /* addAll échoue en bloc si une seule ressource manque : chaque entrée
         est donc traitée séparément, pour qu'un fichier absent ne prive pas
         l'application de tout son cache. */
      .then((c) => Promise.allSettled(NOYAU.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

const estAPI = (url) =>
  url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/api/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (estAPI(url)) return; // laissé au réseau : jamais de donnée périmée

  const externe = url.origin !== self.location.origin;

  /* Bibliothèques externes : cache d'abord, réseau en secours et mise en
     cache au passage. C'est ce qui rend les exports Excel utilisables hors
     ligne dès la deuxième ouverture. */
  if (externe) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req)
            .then((rep) => {
              if (rep && rep.status === 200) {
                const copie = rep.clone();
                caches.open(CACHE_LIBS).then((c) => c.put(req, copie));
              }
              return rep;
            })
            .catch(() => hit)
      )
    );
    return;
  }

  /* Ressources de l'application : cache d'abord pour un démarrage immédiat,
     avec rafraîchissement en arrière-plan. */
  e.respondWith(
    caches.match(req).then((hit) => {
      const reseau = fetch(req)
        .then((rep) => {
          if (rep && rep.status === 200) {
            const copie = rep.clone();
            caches.open(CACHE_NOYAU).then((c) => c.put(req, copie));
          }
          return rep;
        })
        .catch(() => hit);
      return hit || reseau;
    })
  );
});
