/**
 * Translations (English and German) and language selection.
 * Pure: nothing in here touches the DOM, so it is fully unit-testable.
 * Amounts are always formatted the German way (1.000 €), whatever the language, because the
 * Freistellungsaufträge they end up on are German forms.
 */

export type Lang = "en" | "de";

export const LANGS: readonly Lang[] = ["en", "de"];
export const LANG_KEY = "freibetrag-rechner:lang";

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "de";
}

/**
 * Picks the app language from the browser's preferred languages (e.g. `navigator.languages`):
 * the first one we support by its primary subtag (`de-AT` → `de`), English otherwise.
 */
export function detectLang(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const primary = tag.split("-")[0]?.toLowerCase();
    if (isLang(primary)) return primary;
  }
  return "en";
}

/** Text placed into the static page through `data-i18n*` attributes. */
export interface StaticTexts {
  languageLabel: string;
  yearLabel: string;
  prevYear: string;
  nextYear: string;
  startEmpty: string;
  single: string;
  singleSub: string;
  joint: string;
  jointSub: string;
  stillAvailable: string;
  addPlaceholder: string;
  addLabel: string;
  add: string;
  total: string;
  empty: string;
  savedLocally: string;
  resetAmounts: string;
  deleteYear: string;
  institutionName: string;
  removeInstitution: string;
  remove: string;
  amount: string;
  minusOne: string;
  amountInEuros: string;
  plusOne: string;
  fillRest: string;
  fillRestTitle: string;
  holdersTitle: string;
  holderLabel: string;
  cancel: string;
  ok: string;
}

export type StaticKey = keyof StaticTexts;

/** Everything the UI says, in one language. Amount arguments are already formatted. */
export interface Messages {
  text: StaticTexts;
  saved: string;
  notSaved: string;
  noSave: (year: number) => string;
  noSaveCopy: (year: number, prev: number) => string;
  copyYear: (prev: number) => string;
  confirmDeleteYear: (year: number) => string;
  confirmScale: (used: string, total: string) => string;
  confirmRemove: (name: string, amount: string) => string;
  confirmReset: string;
  usedOf: (used: string, total: string) => string;
  max: (amount: string) => string;
  resultsTitle: (year: number) => string;
  holderName: (n: number) => string;
}

const en: Messages = {
  text: {
    languageLabel: "Language",
    yearLabel: "Year",
    prevYear: "Previous year",
    nextYear: "Next year",
    startEmpty: "Start empty",
    single: "Single",
    singleSub: "1.000 €",
    joint: "Joint (2 people)",
    jointSub: "2.000 € shared",
    stillAvailable: "Still available",
    addPlaceholder: "Bank or broker name",
    addLabel: "New institution name",
    add: "Add",
    total: "Total",
    empty: "Add the banks and brokers you want to send a Freistellungsauftrag to.",
    savedLocally: "Saved on this device only",
    resetAmounts: "Reset amounts",
    deleteYear: "Delete this year",
    institutionName: "Institution name",
    removeInstitution: "Remove institution",
    remove: "Remove",
    amount: "Amount",
    minusOne: "Minus 1 €",
    amountInEuros: "Amount in euros",
    plusOne: "Plus 1 €",
    fillRest: "+ rest",
    fillRestTitle: "Assign all remaining to this institution",
    holdersTitle: "Account holders",
    holderLabel: "Account holder",
    cancel: "Cancel",
    ok: "OK",
  },
  saved: "saved",
  notSaved: "no save yet",
  noSave: (year) => `There is no save for ${String(year)} yet.`,
  noSaveCopy: (year, prev) =>
    `There is no save for ${String(year)} yet. Start from your ${String(prev)} distribution, or with an empty list?`,
  copyYear: (prev) => `Copy ${String(prev)}`,
  confirmDeleteYear: (year) => `Delete the save for ${String(year)}? This cannot be undone.`,
  confirmScale: (used, total) =>
    `Your allocations (${used}) exceed ${total}. Scale them down proportionally?`,
  confirmRemove: (name, amount) => `Remove "${name}" and free ${amount}?`,
  confirmReset: "Set all amounts to 0 €?",
  usedOf: (used, total) => `${used} of ${total} assigned`,
  max: (amount) => `max ${amount}`,
  resultsTitle: (year) => `Freistellungsaufträge ${String(year)}`,
  holderName: (n) => `Name of account holder ${String(n)}`,
};

const de: Messages = {
  text: {
    languageLabel: "Sprache",
    yearLabel: "Jahr",
    prevYear: "Vorheriges Jahr",
    nextYear: "Nächstes Jahr",
    startEmpty: "Leer beginnen",
    single: "Einzeln",
    singleSub: "1.000 €",
    joint: "Gemeinsam",
    jointSub: "2.000 € zu zweit",
    stillAvailable: "Noch verfügbar",
    addPlaceholder: "Bank oder Broker",
    addLabel: "Name des neuen Instituts",
    add: "Hinzufügen",
    total: "Summe",
    empty: "Füge die Banken und Broker hinzu, denen du einen Freistellungsauftrag erteilen möchtest.",
    savedLocally: "Nur auf diesem Gerät gespeichert",
    resetAmounts: "Beträge zurücksetzen",
    deleteYear: "Dieses Jahr löschen",
    institutionName: "Name des Instituts",
    removeInstitution: "Institut entfernen",
    remove: "Entfernen",
    amount: "Betrag",
    minusOne: "Minus 1 €",
    amountInEuros: "Betrag in Euro",
    plusOne: "Plus 1 €",
    fillRest: "+ Rest",
    fillRestTitle: "Den ganzen Rest diesem Institut zuweisen",
    holdersTitle: "Kontoinhaber",
    holderLabel: "Kontoinhaber",
    cancel: "Abbrechen",
    ok: "OK",
  },
  saved: "gespeichert",
  notSaved: "noch nicht gespeichert",
  noSave: (year) => `Für ${String(year)} ist noch nichts gespeichert.`,
  noSaveCopy: (year, prev) =>
    `Für ${String(year)} ist noch nichts gespeichert. Mit der Verteilung von ${String(prev)} beginnen oder mit einer leeren Liste?`,
  copyYear: (prev) => `${String(prev)} übernehmen`,
  confirmDeleteYear: (year) =>
    `Die gespeicherten Daten für ${String(year)} löschen? Das lässt sich nicht rückgängig machen.`,
  confirmScale: (used, total) => `Deine Beträge (${used}) übersteigen ${total}. Anteilig kürzen?`,
  confirmRemove: (name, amount) => `„${name}“ entfernen und ${amount} freigeben?`,
  confirmReset: "Alle Beträge auf 0 € setzen?",
  usedOf: (used, total) => `${used} von ${total} verteilt`,
  max: (amount) => `max. ${amount}`,
  resultsTitle: (year) => `Freistellungsaufträge ${String(year)}`,
  holderName: (n) => `Name von Kontoinhaber ${String(n)}`,
};

const MESSAGES: Readonly<Record<Lang, Messages>> = { en, de };

export const messagesFor = (lang: Lang): Messages => MESSAGES[lang];

/** Narrows a `data-i18n*` attribute value to a known key. */
export function isStaticKey(key: string): key is StaticKey {
  return Object.hasOwn(en.text, key);
}
