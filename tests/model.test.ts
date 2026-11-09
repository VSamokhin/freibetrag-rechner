import { describe, expect, it } from "vitest";
import {
  LEGACY_KEY,
  STORAGE_KEY,
  type YearState,
  addInstitution,
  allocations,
  cleanName,
  copyYear,
  createId,
  formatEuro,
  isYearState,
  maxFor,
  needsScaling,
  newStore,
  parseStore,
  previousSave,
  remainingOf,
  removeInstitution,
  setAmount,
  switchMode,
  totalOf,
  usedOf,
} from "../src/model";

const year = (mode: YearState["mode"], ...amounts: number[]): YearState => ({
  mode,
  institutions: amounts.map((amount, i) => ({ id: `i${String(i)}`, name: `Bank ${String(i)}`, amount })),
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
    expect(inst).toEqual({ id: "a", name: "ING", amount: 0 });
    expect(s.institutions).toHaveLength(1);
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
