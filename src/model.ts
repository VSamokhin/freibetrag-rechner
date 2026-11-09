/**
 * Pure domain logic: amounts, limits, years and persistence format.
 * Nothing in here touches the DOM, so it is fully unit-testable.
 */

export type Mode = "single" | "joint";

export interface Institution {
  id: string;
  name: string;
  amount: number;
}

/** One year's distribution. */
export interface YearState {
  mode: Mode;
  institutions: Institution[];
}

/** Everything persisted: one save per year, plus the year being viewed. */
export interface Store {
  version: 2;
  current: number;
  years: Record<string, YearState>;
}

/** Sparerpauschbetrag per assessment type (§ 20 Abs. 9 EStG). */
export const TOTALS: Readonly<Record<Mode, number>> = { single: 1000, joint: 2000 };

export const STORAGE_KEY = "freibetrag-rechner:v2";
export const LEGACY_KEY = "freibetrag-rechner:v1";
export const MAX_NAME_LENGTH = 60;

export function isMode(value: unknown): value is Mode {
  return value === "single" || value === "joint";
}

function isInstitution(value: unknown): value is Institution {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.amount === "number" &&
    Number.isFinite(o.amount) &&
    o.amount >= 0
  );
}

export function isYearState(value: unknown): value is YearState {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return isMode(o.mode) && Array.isArray(o.institutions) && o.institutions.every(isInstitution);
}

/** A year state whose allocations fit within its total. */
function isConsistent(state: YearState): boolean {
  return usedOf(state) <= totalOf(state);
}

export function emptyYear(): YearState {
  return { mode: "single", institutions: [] };
}

export function newStore(year: number): Store {
  return { version: 2, current: year, years: { [year]: emptyYear() } };
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Validates a v2 store, keeping only well-formed, consistent years. */
function parseV2(data: unknown): Store | null {
  if (typeof data !== "object" || data === null) return null;
  const o = data as Record<string, unknown>;
  if (o.version !== 2 || !Number.isInteger(o.current) || typeof o.years !== "object" || o.years === null) {
    return null;
  }
  const years: Record<string, YearState> = {};
  for (const [key, value] of Object.entries(o.years as Record<string, unknown>)) {
    if (/^\d{4}$/.test(key) && isYearState(value) && isConsistent(value)) years[key] = value;
  }
  return { version: 2, current: o.current as number, years };
}

/**
 * Builds the store from persisted data. Invalid years are dropped; data from the first
 * version of the app (no years) is moved into `thisYear`.
 */
export function parseStore(raw: string | null, legacyRaw: string | null, thisYear: number): Store {
  const store = parseV2(parseJson(raw));
  if (store) return store;
  const legacy = parseJson(legacyRaw);
  if (isYearState(legacy) && isConsistent(legacy)) {
    return { version: 2, current: thisYear, years: { [thisYear]: legacy } };
  }
  return newStore(thisYear);
}

export const totalOf = (state: YearState): number => TOTALS[state.mode];

export const usedOf = (state: YearState): number => state.institutions.reduce((sum, i) => sum + i.amount, 0);

export const remainingOf = (state: YearState): number => totalOf(state) - usedOf(state);

/** Highest amount this institution may get: what it has plus the free balance. */
export const maxFor = (state: YearState, inst: Institution): number => inst.amount + remainingOf(state);

/** Sets an institution's amount, rounded to whole euros and clamped to [0, maxFor]. */
export function setAmount(state: YearState, inst: Institution, value: number): void {
  const safe = Number.isFinite(value) ? value : 0;
  inst.amount = Math.max(0, Math.min(Math.round(safe), maxFor(state, inst)));
}

/** Whether switching to `mode` requires scaling the current allocations down. */
export const needsScaling = (state: YearState, mode: Mode): boolean => usedOf(state) > TOTALS[mode];

/** Switches mode, scaling allocations down proportionally (rounding down) if they no longer fit. */
export function switchMode(state: YearState, mode: Mode): void {
  const used = usedOf(state);
  const total = TOTALS[mode];
  state.mode = mode;
  if (used > total) {
    const factor = total / used;
    for (const inst of state.institutions) inst.amount = Math.floor(inst.amount * factor);
  }
}

/** Normalises an institution name; returns null when it is empty. */
export function cleanName(name: string): string | null {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed === "" ? null : trimmed;
}

export function addInstitution(state: YearState, name: string, id: string): Institution | null {
  const clean = cleanName(name);
  if (clean === null) return null;
  const inst: Institution = { id, name: clean, amount: 0 };
  state.institutions.push(inst);
  return inst;
}

export function removeInstitution(state: YearState, id: string): void {
  state.institutions = state.institutions.filter((i) => i.id !== id);
}

/** Most recent saved year before `year`, if any. */
export function previousSave(store: Store, year: number): number | null {
  const earlier = Object.keys(store.years)
    .map(Number)
    .filter((y) => y < year);
  return earlier.length > 0 ? Math.max(...earlier) : null;
}

/** Deep copy of a year's state with fresh institution ids. */
export function copyYear(source: YearState, newId: () => string): YearState {
  return { mode: source.mode, institutions: source.institutions.map((i) => ({ ...i, id: newId() })) };
}

/** Institutions that actually get a Freistellungsauftrag (amount above zero). */
export const allocations = (state: YearState): Institution[] =>
  state.institutions.filter((i) => i.amount > 0);

export const formatEuro = (value: number): string =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    value,
  );

export const createId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
