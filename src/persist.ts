/**
 * Persistent storage (SOA-38): asks the browser to keep the app's data instead of treating it as
 * "best effort" storage that may be cleared when the device runs low on space.
 */

/** Outcome of a persistence request. */
export type Persistence = "granted" | "refused" | "unsupported";

/** The part of `navigator.storage` this module uses. */
export type PersistManager = Partial<Pick<StorageManager, "persist" | "persisted">>;

/**
 * Makes the app's storage persistent if the browser allows it.
 * Asks only when the storage is not persistent yet, so a granted request is never repeated.
 * Never throws: a browser without the Storage API reports "unsupported", and a failing call "refused".
 */
export async function requestPersistence(manager: PersistManager | undefined): Promise<Persistence> {
  if (typeof manager?.persist !== "function") return "unsupported";
  try {
    if (typeof manager.persisted === "function" && (await manager.persisted())) return "granted";
    return (await manager.persist()) ? "granted" : "refused";
  } catch {
    return "refused";
  }
}
