import { describe, expect, it } from "vitest";
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  LEGACY_KEY,
  STORAGE_KEY,
  type YearState,
  addInstitution,
  allocations,
  allocationsByHolder,
  backupFileName,
  cleanName,
  copyYear,
  createBackup,
  createId,
  formatEuro,
  isYearState,
  maxFor,
  needsScaling,
  newStore,
  parseBackup,
  parseStore,
  previousSave,
  remainingOf,
  removeInstitution,
  renameHolder,
  setAmount,
  switchMode,
  totalOf,
  usedOf,
} from "../src/model";

const year = (mode: YearState["mode"], ...amounts: number[]): YearState => ({
  mode,
  institutions: amounts.map((amount, i) => ({
    id: `i${String(i)}`,
    name: `Bank ${String(i)}`,
    amount,
    holder: 0,
  })),
  holders: ["Person 1", "Person 2"],
});

describe("totals and balances", () => {
  it("uses 1.000 € for single and 2.000 € for joint", () => {
    expect(totalOf(year("single"))).toBe(1000);
    expect(totalOf(year("joint"))).toBe(2000);
  });

  it("computes used and remaining amounts", () => {
    const s = year("joint", 500, 300);
    expect(usedOf(s)).toBe(800);
    expect(remainingOf(s)).toBe(1200);
    expect(maxFor(s, s.institutions[0]!)).toBe(1700);
  });
});

describe("setAmount", () => {
  it("never lets the total exceed the free balance", () => {
    const s = year("single", 700, 0);
    setAmount(s, s.institutions[1]!, 900);
    expect(s.institutions[1]!.amount).toBe(300);
    expect(remainingOf(s)).toBe(0);
  });

  it("clamps negatives to zero and rounds to whole euros", () => {
    const s = year("single", 100);
    setAmount(s, s.institutions[0]!, -5);
    expect(s.institutions[0]!.amount).toBe(0);
    setAmount(s, s.institutions[0]!, 12.6);
    expect(s.institutions[0]!.amount).toBe(13);
  });

  it("treats non-finite input as zero", () => {
    const s = year("single", 100);
    setAmount(s, s.institutions[0]!, Number.NaN);
    expect(s.institutions[0]!.amount).toBe(0);
  });
});

describe("switchMode", () => {
  it("keeps amounts that still fit", () => {
    const s = year("joint", 400, 300);
    expect(needsScaling(s, "single")).toBe(false);
    switchMode(s, "single");
    expect(s.mode).toBe("single");
    expect(usedOf(s)).toBe(700);
  });

  it("scales amounts down proportionally when they no longer fit", () => {
    const s = year("joint", 1500, 500);
    expect(needsScaling(s, "single")).toBe(true);
    switchMode(s, "single");
    expect(s.institutions.map((i) => i.amount)).toEqual([750, 250]);
    expect(usedOf(s)).toBeLessThanOrEqual(1000);
  });

  it("rounds down so the result never exceeds the new total", () => {
    const s = year("joint", 667, 667, 666);
    switchMode(s, "single");
    expect(usedOf(s)).toBeLessThanOrEqual(1000);
  });
});

describe("institutions", () => {
  it("adds trimmed names and rejects empty ones", () => {
    const s = year("single");
    expect(addInstitution(s, "   ", "x")).toBeNull();
    const inst = addInstitution(s, "  ING  ", "a");
    expect(inst).toEqual({ id: "a", name: "ING", amount: 0, holder: 0 });
    expect(addInstitution(s, "DKB", "b", 1)?.holder).toBe(1);
    expect(s.institutions).toHaveLength(2);
  });

  it("limits name length", () => {
    expect(cleanName("x".repeat(100))).toHaveLength(60);
  });

  it("removes by id", () => {
    const s = year("single", 1, 2);
    removeInstitution(s, "i0");
    expect(s.institutions.map((i) => i.id)).toEqual(["i1"]);
  });

  it("lists only non-zero allocations", () => {
    expect(allocations(year("single", 0, 200, 0)).map((i) => i.amount)).toEqual([200]);
  });
});

describe("account holders (joint mode)", () => {
  it("starts with two default names", () => {
    expect(newStore(2026).years["2026"]!.holders).toEqual(["Person 1", "Person 2"]);
  });

  it("renames a holder and ignores blank names", () => {
    const s = year("joint");
    expect(renameHolder(s, 1, "  Anna  ")).toBe(true);
    expect(renameHolder(s, 0, "   ")).toBe(false);
    expect(s.holders).toEqual(["Person 1", "Anna"]);
  });

  it("groups non-zero allocations by holder, keeping the overall total", () => {
    const s = year("joint", 300, 0, 200, 500);
    s.institutions[2]!.holder = 1;
    s.institutions[3]!.holder = 1;
    s.holders = ["Max", "Anna"];
    const groups = allocationsByHolder(s);
    expect(groups.map((g) => [g.name, g.items.map((i) => i.name), g.total])).toEqual([
      ["Max", ["Bank 0"], 300],
      ["Anna", ["Bank 2", "Bank 3"], 700],
    ]);
    expect(groups.reduce((sum, g) => sum + g.total, 0)).toBe(usedOf(s));
  });

  it("leaves out holders without allocations", () => {
    const s = year("joint", 0, 100);
    expect(allocationsByHolder(s).map((g) => g.holder)).toEqual([0]);
  });
});

describe("years", () => {
  it("finds the most recent earlier save", () => {
    const store = { ...newStore(2024), years: { 2022: year("single"), 2024: year("single") } };
    expect(previousSave(store, 2026)).toBe(2024);
    expect(previousSave(store, 2024)).toBe(2022);
    expect(previousSave(store, 2022)).toBeNull();
  });

  it("copies a year independently with new ids", () => {
    const src = year("joint", 100);
    let n = 0;
    const copy = copyYear(src, () => `new${String(n++)}`);
    copy.institutions[0]!.amount = 999;
    expect(src.institutions[0]!.amount).toBe(100);
    expect(copy.institutions[0]!.id).toBe("new0");
    expect(copy.mode).toBe("joint");
    copy.holders[0] = "Max";
    expect(src.holders[0]).toBe("Person 1");
  });
});

describe("parseStore", () => {
  it("starts fresh without data", () => {
    expect(parseStore(null, null, 2026)).toEqual(newStore(2026));
  });

  it("loads a valid v2 store", () => {
    const stored = { version: 2, current: 2025, years: { 2025: year("joint", 100) } };
    expect(parseStore(JSON.stringify(stored), null, 2026)).toEqual(stored);
  });

  it("drops invalid or over-allocated years but keeps valid ones", () => {
    const stored = {
      version: 2,
      current: 2026,
      years: {
        2024: { mode: "x" },
        2025: year("single", 2000),
        2026: year("single", 10),
        abc: year("single"),
      },
    };
    expect(Object.keys(parseStore(JSON.stringify(stored), null, 2026).years)).toEqual(["2026"]);
  });

  it("migrates legacy v1 data into the current year", () => {
    const legacy = year("joint", 1200, 300);
    expect(parseStore(null, JSON.stringify(legacy), 2026)).toEqual({
      version: 2,
      current: 2026,
      years: { 2026: legacy },
    });
  });

  it("ignores corrupt JSON and invalid legacy data", () => {
    expect(parseStore("{nope", "[]", 2026)).toEqual(newStore(2026));
    expect(parseStore(JSON.stringify({ version: 1 }), JSON.stringify({ mode: "single" }), 2026)).toEqual(
      newStore(2026),
    );
  });

  it("fills in holder data missing from saves made before account holders existed", () => {
    const old = {
      version: 2,
      current: 2026,
      years: { 2026: { mode: "joint", institutions: [{ id: "a", name: "ING", amount: 100 }] } },
    };
    expect(parseStore(JSON.stringify(old), null, 2026).years["2026"]).toEqual({
      mode: "joint",
      institutions: [{ id: "a", name: "ING", amount: 100, holder: 0 }],
      holders: ["Person 1", "Person 2"],
    });
  });

  it("replaces blank stored holder names by the defaults", () => {
    const stored = {
      version: 2,
      current: 2026,
      years: { 2026: { ...year("joint"), holders: ["Max", " "] } },
    };
    expect(parseStore(JSON.stringify(stored), null, 2026).years["2026"]!.holders).toEqual([
      "Max",
      "Person 2",
    ]);
  });

  it("rejects malformed holder data", () => {
    const bank = { id: "a", name: "A", amount: 1 };
    expect(isYearState({ mode: "joint", institutions: [{ ...bank, holder: 2 }] })).toBe(false);
    expect(isYearState({ mode: "joint", institutions: [], holders: ["only one"] })).toBe(false);
    expect(isYearState({ mode: "joint", institutions: [], holders: ["a", 3] })).toBe(false);
    expect(isYearState({ mode: "joint", institutions: [{ ...bank, holder: 1 }], holders: ["a", "b"] })).toBe(
      true,
    );
  });

  it("rejects institutions with bad amounts", () => {
    expect(isYearState({ mode: "single", institutions: [{ id: "a", name: "A", amount: -1 }] })).toBe(false);
    expect(isYearState({ mode: "single", institutions: [null] })).toBe(false);
    expect(isYearState(null)).toBe(false);
  });

  it("uses distinct storage keys per format version", () => {
    expect(STORAGE_KEY).not.toBe(LEGACY_KEY);
  });
});

describe("helpers", () => {
  it("formats euros the German way", () => {
    expect(formatEuro(1995).replace(/\s/g, " ")).toBe("1.995 €");
  });

  it("creates unique ids", () => {
    expect(createId()).not.toBe(createId());
  });
});

describe("backup (SOA-36)", () => {
  const now = new Date(2026, 10, 3, 9, 5);
  const store = {
    version: 2 as const,
    current: 2026,
    years: { 2025: year("single", 300), 2026: year("joint", 1500) },
  };
  const file = (data: Record<string, unknown>): string =>
    JSON.stringify({ app: BACKUP_APP, format: BACKUP_FORMAT, years: store.years, ...data });

  it("writes every year with its own format version and the app version", () => {
    const backup = createBackup(store, "0.4.1", now);
    expect(backup).toEqual({
      app: "freibetrag-rechner",
      format: 1,
      appVersion: "0.4.1",
      exportedAt: now.toISOString(),
      years: store.years,
    });
    expect(backupFileName(now)).toBe("freibetrag-rechner-2026-11-03.json");
  });

  it("reads back what it writes", () => {
    expect(parseBackup(JSON.stringify(createBackup(store, "0.4.1", now)))).toEqual({
      ok: true,
      years: store.years,
    });
  });

  it("refuses files written in a newer format", () => {
    expect(parseBackup(file({ format: BACKUP_FORMAT + 1 }))).toEqual({ ok: false, error: "newer" });
  });

  it.each([
    ["not JSON", "{"],
    ["another app", file({ app: "something-else" })],
    ["no format", file({ format: undefined })],
    ["a fractional format", file({ format: 1.5 })],
    ["format 0", file({ format: 0 })],
    ["years as a list", file({ years: [year("single")] })],
    ["no years", file({ years: {} })],
    ["a bad year key", file({ years: { "26": year("single") } })],
    ["a malformed year", file({ years: { 2026: { mode: "both", institutions: [] } } })],
    ["an over-allocated year", file({ years: { 2025: year("single"), 2026: year("single", 800, 300) } })],
    ["a JSON array", "[]"],
  ])("refuses the whole file with %s", (_, raw) => {
    expect(parseBackup(raw)).toEqual({ ok: false, error: "invalid" });
  });

  it("fills in holder data and ignores unknown extra fields", () => {
    const old = { mode: "joint", institutions: [{ id: "a", name: "ING", amount: 5 }], extra: true };
    const result = parseBackup(file({ years: { 2024: old }, comment: "kept by a newer app" }));
    expect(result).toEqual({
      ok: true,
      years: {
        2024: {
          mode: "joint",
          institutions: [{ id: "a", name: "ING", amount: 5, holder: 0 }],
          holders: ["Person 1", "Person 2"],
        },
      },
    });
  });
});
