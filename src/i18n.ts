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
  backupTitle: string;
  backupText: string;
  exportBackup: string;
  importBackup: string;
  persistHint: string;
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
  confirmImport: (years: number) => string;
  imported: (years: number) => string;
  importInvalid: string;
  importNewer: string;
  importTooLarge: string;
  exported: (file: string) => string;
}

const yearsEn = (n: number): string => (n === 1 ? "1 year" : `${String(n)} years`);
const yearsDe = (n: number): string => (n === 1 ? "1 Jahr" : `${String(n)} Jahre`);

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
    backupTitle: "Backup",
    backupText: "Save every year to a file, for example in your cloud storage, or restore them from one.",
    exportBackup: "Export to file",
    importBackup: "Import from file",
    persistHint:
      "This browser may delete saved data when the device runs low on space. Export a backup now and then.",
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
  confirmImport: (years) =>
    `Replace all saved years on this device with the ${yearsEn(years)} from the backup? This cannot be undone.`,
  imported: (years) => `Restored ${yearsEn(years)} from the backup.`,
  importInvalid: "This file is not a Freibetrag-Rechner backup, or it is damaged. Nothing was changed.",
  importNewer:
    "This backup was made by a newer version of the app. Please update the app, then import it again. Nothing was changed.",
  importTooLarge: "This file is too large to be a Freibetrag-Rechner backup. Nothing was changed.",
  exported: (file) =>
    `Your browser should now save ${file}, usually in Downloads. If it does not appear there, the browser or the page around the app blocked the download.`,
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
    backupTitle: "Sicherung",
    backupText:
      "Alle Jahre in einer Datei sichern, etwa in deinem Cloud-Speicher, oder aus einer Datei wiederherstellen.",
    exportBackup: "In Datei exportieren",
    importBackup: "Aus Datei importieren",
    persistHint:
      "Dieser Browser kann gespeicherte Daten löschen, wenn der Speicher knapp wird. Exportiere ab und zu eine Sicherung.",
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
  confirmImport: (years) =>
    `Alle auf diesem Gerät gespeicherten Jahre durch die Sicherung (${yearsDe(years)}) ersetzen? Das lässt sich nicht rückgängig machen.`,
  imported: (years) => `${yearsDe(years)} aus der Sicherung wiederhergestellt.`,
  importInvalid:
    "Diese Datei ist keine Sicherung des Freibetrag-Rechners oder sie ist beschädigt. Es wurde nichts geändert.",
  importNewer:
    "Diese Sicherung stammt von einer neueren Version der App. Bitte aktualisiere die App und importiere sie dann erneut. Es wurde nichts geändert.",
  importTooLarge:
    "Diese Datei ist zu groß für eine Sicherung des Freibetrag-Rechners. Es wurde nichts geändert.",
  exported: (file) =>
    `Dein Browser sollte jetzt ${file} speichern, meist unter Downloads. Fehlt die Datei dort, hat der Browser oder die Seite um die App den Download blockiert.`,
};

const MESSAGES: Readonly<Record<Lang, Messages>> = { en, de };

export const messagesFor = (lang: Lang): Messages => MESSAGES[lang];

/** Narrows a `data-i18n*` attribute value to a known key. */
export function isStaticKey(key: string): key is StaticKey {
  return Object.hasOwn(en.text, key);
}
