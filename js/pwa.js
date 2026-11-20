// @ts-check
// Registers the service worker that makes the app work offline.
// The path is resolved from this file, so the registration works from the main page
// and from the inventory page. The service worker lives in the project root, so its
// scope covers the whole app.

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).catch((error) => {
      console.error("The service worker could not be registered.", error);
    });
  });
}
