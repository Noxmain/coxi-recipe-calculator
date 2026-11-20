// Service worker: makes the app work offline.
// Strategy: network first, cache as fallback. Every successful response is stored,
// so the app works offline after it has been opened once while online.
// This file is not type-checked, because the service worker global scope needs its own typings.

/**
 * Bump this name when old cache entries should be removed on the next visit, for
 * example after files have moved. Ordinary updates do not need it.
 */
const CACHE_VERSION = "coxi-v2";

/**
 * Files of the app shell, relative to this file. Recipe files are added during install.
 * Every new JavaScript, CSS or HTML file must be listed here, or it is missing offline.
 */
const SHELL_FILES = [
  "./",
  "index.html",
  "inventory/",
  "inventory/index.html",
  "recipes/",
  "recipes/index.html",
  "ingredients/",
  "ingredients/index.html",
  "manifest.webmanifest",
  "css/style.css",
  "css/app.css",
  "fonts/BricolageGrotesque-Variable.woff2",
  "icons/icon.svg",
  "icons/apple-touch-icon.png",
  "js/data.js",
  "js/pages/main.js",
  "js/pages/inventory.js",
  "js/pages/recipes.js",
  "js/pages/ingredients.js",
  "js/pwa.js",
  "js/storage.js",
  "js/core/format.js",
  "js/core/ingredient-editing.js",
  "js/core/inventory.js",
  "js/core/planner.js",
  "js/core/recipe-editing.js",
  "js/core/recipes.js",
  "js/core/shopping.js",
  "js/core/types.js",
  "js/core/utils.js",
  "js/core/validation.js",
  "js/pdf/documents.js",
  "js/ui/fit-input.js",
  "js/ui/ingredient-editor.js",
  "js/ui/inventory-import.js",
  "js/ui/planner.js",
  "js/ui/recipe-editor.js",
  "js/ui/reset-data.js",
  "js/ui/results.js",
  "js/ui/share.js",
  "vendor/pdfmake/pdfmake.min.js",
  "vendor/pdfmake/vfs_fonts.js",
  "vendor/qrcode-generator/qrcode.js",
  "ingredients/ingredients.json",
  "recipes/index.json",
];

/**
 * @param {string} path
 * @returns {string} Absolute URL of a file of the app.
 */
function appUrl(path) {
  return new URL(path, self.registration.scope).href;
}

/**
 * Stores the shell and every recipe file listed in recipes/index.json.
 * If one file is missing, the installation fails and the old version stays active.
 * @param {Cache} cache
 */
async function precache(cache) {
  await cache.addAll(SHELL_FILES.map(appUrl));

  const response = await cache.match(appUrl("recipes/index.json"));
  const { recipes } = await response.json();
  await cache.addAll(recipes.map((id) => appUrl(`recipes/${id}.json`)));
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
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const key = cacheKey(request);

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

/**
 * Pages are stored without their query string, so every plan (?p=…&r=…) is served
 * by the stored page of the same address. Other files are stored by their full URL.
 * @param {Request} request
 * @returns {Request | string}
 */
function cacheKey(request) {
  if (request.mode !== "navigate") return request;
  const url = new URL(request.url);
  return url.origin + url.pathname;
}
