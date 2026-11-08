// @ts-check
// Registers the service worker that makes the app work offline.
// The service worker lives in the project root, so its scope covers the whole app.

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.error("The service worker could not be registered.", error);
    });
  });
}
