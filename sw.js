// Service worker: makes the app work offline.
// Strategy: network first, cache as fallback. Every successful response is stored,
// so the app works offline after it has been opened once while online.
// This file is not type-checked, because the service worker global scope needs its own typings.

/**
 * Bump this name when old cache entries should be removed on the next visit.
 * It is not needed for ordinary updates, because the network is always tried first.
 */
const CACHE_VERSION = "coxi-v1";

/** Files of the app shell, relative to this file. Recipe files are added during install. */
const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "fonts/BricolageGrotesque-Variable.woff2",
  "icons/icon.svg",
  "js/app.js",
  "js/pwa.js",
  "js/core/format.js",
  "js/core/inventory.js",
  "js/core/planner.js",
  "js/core/recipes.js",
  "js/core/shopping.js",
  "js/core/types.js",
  "js/core/utils.js",
  "js/core/validation.js",
  "js/pdf/documents.js",
  "js/ui/fit-input.js",
  "js/ui/inventory-import.js",
  "js/ui/planner.js",
  "js/ui/results.js",
  "js/ui/share.js",
  "vendor/pdfmake/pdfmake.min.js",
  "vendor/pdfmake/vfs_fonts.js",
  "vendor/qrcode-generator/qrcode.js",
  "data/ingredients.json",
  "data/recipes/index.json",
];

/**
 * @param {string} path
 * @returns {string} Absolute URL of a file of the app.
 */
function appUrl(path) {
  return new URL(path, self.registration.scope).href;
}

/**
 * Stores the shell and every recipe file listed in data/recipes/index.json.
 * If one file is missing, the installation fails and the old version stays active.
 * @param {Cache} cache
 */
async function precache(cache) {
  await cache.addAll(SHELL_FILES.map(appUrl));

  const response = await cache.match(appUrl("data/recipes/index.json"));
  const { recipes } = await response.json();
  await cache.addAll(recipes.map((id) => appUrl(`data/recipes/${id}.json`)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(precache)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(event.request));
});

/**
 * Tries the network first and stores the answer. Offline, the stored answer is used.
 * Page loads always use the stored index.html, because the plan lives in the query string.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const isPage = request.mode === "navigate";
  const key = isPage ? appUrl("index.html") : request;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(key, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;
    return new Response("This file is not available offline.", {
      status: 503,
      statusText: "Offline",
    });
  }
}
