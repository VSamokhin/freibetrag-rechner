import { describe, expect, it, vi } from "vitest";
import { requestPersistence } from "../src/persist";

describe("requestPersistence", () => {
  it("reports unsupported without the Storage API", async () => {
    expect(await requestPersistence(undefined)).toBe("unsupported");
    expect(await requestPersistence({})).toBe("unsupported");
    expect(await requestPersistence({ persisted: () => Promise.resolve(false) })).toBe("unsupported");
  });

  it("does not ask again when the storage is already persistent", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    expect(await requestPersistence({ persisted: () => Promise.resolve(true), persist })).toBe("granted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks once and reports a grant", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    expect(await requestPersistence({ persisted: () => Promise.resolve(false), persist })).toBe("granted");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("asks even without persisted()", async () => {
    expect(await requestPersistence({ persist: () => Promise.resolve(true) })).toBe("granted");
  });

  it("reports a refusal", async () => {
    expect(
      await requestPersistence({
        persisted: () => Promise.resolve(false),
        persist: () => Promise.resolve(false),
      }),
    ).toBe("refused");
  });

  it("treats a failing call as a refusal instead of throwing", async () => {
    expect(await requestPersistence({ persist: () => Promise.reject(new Error("SecurityError")) })).toBe(
      "refused",
    );
    expect(
      await requestPersistence({
        persisted: () => Promise.reject(new Error("x")),
        persist: () => Promise.resolve(true),
      }),
    ).toBe("refused");
  });
});
