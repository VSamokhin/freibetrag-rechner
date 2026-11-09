import { App } from "./app";

function start(): void {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  new App(document, { storage }).mount();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Offline support is optional; the app works without it.
    });
  }
}

document.addEventListener("DOMContentLoaded", start);
