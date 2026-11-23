// Service worker de Pouce, généré au build (`vite.config.ts`, plugin
// `serviceWorker`) : les deux marques de VERSION et ASSETS ci-dessous y sont
// remplacées par la version et la liste des fichiers de l'application.
//
// - Application (scripts, styles, polices, icônes, index.html, et
//   OpenSheetMusicDisplay) gardée sur l'appareil : Pouce s'ouvre sans réseau.
// - Liste du catalogue sans recherche (`/api/catalog`) : le réseau d'abord,
//   la dernière réponse gardée sinon.
// - Sons de piano (`/piano/`, Salamander) : gardés à la première écoute,
//   d'une version de l'application à l'autre.
// - Partitions ouvertes, importées, doigtés et réglages : dans IndexedDB,
//   gérés par l'application. Rien à faire ici.

const VERSION = '__VERSION__';
const ASSETS = __ASSETS__;
const APP_CACHE = `pouce-app-${VERSION}`;
// Format des réponses de l'API : changer le nom à chaque changement.
const API_CACHE = 'pouce-api-4';
// Échantillons de piano : ne changent pas avec l'application.
const PIANO_CACHE = 'pouce-piano-1';
// Page ou API : le réseau d'abord, l'appareil s'il ne répond pas assez vite.
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(APP_CACHE)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // Garde la version précédente : une page encore ouverte avec
            // l'ancienne application peut y charger ses fichiers.
            const names = (await caches.keys()).filter(
                (name) => name.startsWith('pouce-app-') && name !== APP_CACHE,
            );
            for (const name of names.slice(0, -1)) await caches.delete(name);
            // Réponses de l'API dans un ancien format.
            for (const name of await caches.keys()) {
                if (name.startsWith('pouce-api') && name !== API_CACHE) {
                    await caches.delete(name);
                }
            }
            await self.clients.claim();
        })(),
    );
});

const withTimeout = (promise, ms) =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('lent')), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });

const navigate = async (request) => {
    try {
        return await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    } catch {
        const cache = await caches.open(APP_CACHE);
        return (await cache.match('/')) ?? Response.error();
    }
};

/** Liste du catalogue : réponse du réseau gardée, rendue quand il ne répond pas. */
const catalog = async (request) => {
    const cache = await caches.open(API_CACHE);
    try {
        const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
        if (response.ok) await cache.put(request, response.clone());
        return response;
    } catch (error) {
        const saved = await cache.match(request);
        if (saved) return saved;
        throw error;
    }
};

const appFile = async (request) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(APP_CACHE);
        await cache.put(request, response.clone());
    }
    return response;
};

/** Son de piano : l'appareil d'abord, téléchargé une seule fois. */
const pianoFile = async (request) => {
    const cache = await caches.open(PIANO_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
};

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Liste du catalogue sans recherche (première page) : gardée pour
    // l'ouverture hors ligne. Les recherches et les partitions passent par le
    // réseau ; l'appli garde elle-même les partitions ouvertes (IndexedDB).
    if (
        url.pathname === '/api/catalog' &&
        !url.searchParams.get('q') &&
        !url.searchParams.get('offset') &&
        !url.searchParams.get('group')
    ) {
        event.respondWith(catalog(request));
    } else if (url.pathname.startsWith('/piano/')) {
        event.respondWith(pianoFile(request));
    } else if (url.pathname.startsWith('/api/')) {
        // Réseau seulement.
    } else if (request.mode === 'navigate') {
        event.respondWith(navigate(request));
    } else {
        event.respondWith(appFile(request));
    }
});
