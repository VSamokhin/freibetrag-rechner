/**
 * Pure domain logic: amounts, limits, years and persistence format.
 * Nothing in here touches the DOM, so it is fully unit-testable.
 */

export type Mode = "single" | "joint";

/** Which of the two people in joint mode holds an account: 0 or 1. */
export type Holder = 0 | 1;

export interface Institution {
  id: string;
  name: string;
  amount: number;
  /** Account holder in joint mode; ignored in single mode. */
  holder: Holder;
}

/** One year's distribution. */
export interface YearState {
  mode: Mode;
  institutions: Institution[];
  /** Names of the two people in joint mode, indexed by {@link Holder}. */
  holders: [string, string];
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
export const HOLDERS: readonly Holder[] = [0, 1];
export const DEFAULT_HOLDERS: readonly [string, string] = ["Person 1", "Person 2"];

export function isMode(value: unknown): value is Mode {
  return value === "single" || value === "joint";
}

export function isHolder(value: unknown): value is Holder {
  return value === 0 || value === 1;
}

/** Persisted institution; saves from before SOA-33 have no holder. */
type StoredInstitution = Omit<Institution, "holder"> & { holder?: Holder };
/** Persisted year; saves from before SOA-33 have no holder names. */
type StoredYear = Omit<YearState, "institutions" | "holders"> & {
  institutions: StoredInstitution[];
  holders?: [string, string];
};

function isInstitution(value: unknown): value is StoredInstitution {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.amount === "number" &&
    Number.isFinite(o.amount) &&
    o.amount >= 0 &&
    (o.holder === undefined || isHolder(o.holder))
  );
}

function isHolderNames(value: unknown): value is [string, string] {
  return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "string");
}

/** Whether `value` is a well-formed saved year (holder data may be missing, as in older saves). */
export function isYearState(value: unknown): value is StoredYear {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    isMode(o.mode) &&
    Array.isArray(o.institutions) &&
    o.institutions.every(isInstitution) &&
    (o.holders === undefined || isHolderNames(o.holders))
  );
}

/** Fills in holder data missing from older saves, and replaces blank holder names by the defaults. */
function normalise(stored: StoredYear): YearState {
  const names = stored.holders ?? DEFAULT_HOLDERS;
  return {
    mode: stored.mode,
    institutions: stored.institutions.map((i) => ({ ...i, holder: i.holder ?? 0 })),
    holders: [cleanName(names[0]) ?? DEFAULT_HOLDERS[0], cleanName(names[1]) ?? DEFAULT_HOLDERS[1]],
  };
}

/** A year state whose allocations fit within its total. */
function isConsistent(state: StoredYear): boolean {
  return state.institutions.reduce((sum, i) => sum + i.amount, 0) <= TOTALS[state.mode];
}

export function emptyYear(): YearState {
  return { mode: "single", institutions: [], holders: [...DEFAULT_HOLDERS] };
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

const isYearKey = (key: string): boolean => /^\d{4}$/.test(key);

/** Whether `value` is a non-null, non-array object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validates a v2 store, keeping only well-formed, consistent years. */
function parseV2(data: unknown): Store | null {
  if (!isRecord(data)) return null;
  if (data.version !== 2 || !Number.isInteger(data.current) || !isRecord(data.years)) return null;
  const years: Record<string, YearState> = {};
  for (const [key, value] of Object.entries(data.years)) {
    if (isYearKey(key) && isYearState(value) && isConsistent(value)) years[key] = normalise(value);
  }
  return { version: 2, current: data.current as number, years };
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
    return { version: 2, current: thisYear, years: { [thisYear]: normalise(legacy) } };
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

/** Normalises an institution or holder name; returns null when it is empty. */
export function cleanName(name: string): string | null {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed === "" ? null : trimmed;
}

export function addInstitution(
  state: YearState,
  name: string,
  id: string,
  holder: Holder = 0,
): Institution | null {
  const clean = cleanName(name);
  if (clean === null) return null;
  const inst: Institution = { id, name: clean, amount: 0, holder };
  state.institutions.push(inst);
  return inst;
}

/** Renames one of the two holders; returns false (and keeps the old name) when the new one is empty. */
export function renameHolder(state: YearState, holder: Holder, name: string): boolean {
  const clean = cleanName(name);
  if (clean === null) return false;
  state.holders[holder] = clean;
  return true;
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
  return {
    mode: source.mode,
    institutions: source.institutions.map((i) => ({ ...i, id: newId() })),
    holders: [...source.holders],
  };
}

/** Institutions that actually get a Freistellungsauftrag (amount above zero). */
export const allocations = (state: YearState): Institution[] =>
  state.institutions.filter((i) => i.amount > 0);

export interface HolderGroup {
  holder: Holder;
  name: string;
  items: Institution[];
  total: number;
}

/**
 * Allocations grouped by account holder, for display in joint mode. Holders without any
 * allocation are left out; the overall total is unchanged by the grouping.
 */
export const allocationsByHolder = (state: YearState): HolderGroup[] =>
  HOLDERS.map((holder) => {
    const items = allocations(state).filter((i) => i.holder === holder);
    return { holder, name: state.holders[holder], items, total: items.reduce((sum, i) => sum + i.amount, 0) };
  }).filter((g) => g.items.length > 0);

export const formatEuro = (value: number): string =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    value,
  );

export const createId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---- backup file (SOA-36) ---------------------------------------------------

/** Marks a file as a backup of this app. */
export const BACKUP_APP = "freibetrag-rechner";
/**
 * Version of the backup file format, independent of the app version. Raise it only for a change
 * that older apps cannot read correctly (a renamed or re-typed field, a new required field, other
 * meanings); adding optional fields that older apps may ignore keeps it. An app refuses files whose
 * format is newer than the one it supports, and reads every older one it knows.
 */
export const BACKUP_FORMAT = 1;
/** Largest file accepted for import; real backups are a few kilobytes. */
export const MAX_BACKUP_BYTES = 1_000_000;

/** Contents of a backup file: every saved year. */
export interface Backup {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  /** Version of the app that wrote the file, for information only. */
  appVersion: string;
  /** When the file was written (ISO 8601), for information only. */
  exportedAt: string;
  years: Record<string, YearState>;
}

export type BackupError = "invalid" | "newer";

export type BackupResult = { ok: true; years: Record<string, YearState> } | { ok: false; error: BackupError };

export function createBackup(store: Store, appVersion: string, now: Date): Backup {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    appVersion,
    exportedAt: now.toISOString(),
    years: store.years,
  };
}

/** File name for a backup written on `now`, e.g. `freibetrag-rechner-2026-11-10.json`. */
export function backupFileName(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const date = `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${BACKUP_APP}-${date}.json`;
}

/**
 * Reads a backup file. The whole file is refused (nothing is imported) if it is not a backup of
 * this app, if any year in it is malformed or over its limit, or if it holds no year at all;
 * `newer` means it was written in a format this app does not know yet.
 */
export function parseBackup(raw: string): BackupResult {
  const data = parseJson(raw);
  if (!isRecord(data) || data.app !== BACKUP_APP || !Number.isInteger(data.format)) {
    return { ok: false, error: "invalid" };
  }
  const format = data.format as number;
  if (format > BACKUP_FORMAT) return { ok: false, error: "newer" };
  if (format < 1 || !isRecord(data.years)) return { ok: false, error: "invalid" };
  const entries = Object.entries(data.years);
  const years: Record<string, YearState> = {};
  for (const [key, value] of entries) {
    if (!isYearKey(key) || !isYearState(value) || !isConsistent(value))
      return { ok: false, error: "invalid" };
    years[key] = normalise(value);
  }
  return entries.length > 0 ? { ok: true, years } : { ok: false, error: "invalid" };
}
