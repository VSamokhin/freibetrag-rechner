import { App } from "./app";

function start(): void {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  const app = new App(document, {
    storage,
    languages: navigator.languages,
    storageManager: (navigator as { storage?: StorageManager }).storage,
  });
  app.mount();
  void app.keepData();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Offline support is optional; the app works without it.
    });
  }
}

document.addEventListener("DOMContentLoaded", start);
