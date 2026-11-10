import { describe, expect, it } from "vitest";
import { LANGS, type Messages, detectLang, isLang, isStaticKey, messagesFor } from "../src/i18n";

describe("detectLang", () => {
  it.each([
    [["de-DE", "en"], "de"],
    [["de-AT"], "de"],
    [["DE"], "de"],
    [["fr-FR", "en-GB", "de"], "en"],
    [["fr", "ru"], "en"],
    [[], "en"],
    [[""], "en"],
  ] as const)("%j → %s", (languages, expected) => {
    expect(detectLang(languages)).toBe(expected);
  });
});

describe("isLang / isStaticKey", () => {
  it("accepts only supported languages and known keys", () => {
    expect(LANGS.every(isLang)).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isStaticKey("add")).toBe(true);
    expect(isStaticKey("toString")).toBe(false);
    expect(isStaticKey("nope")).toBe(false);
  });
});

describe("messages", () => {
  const sample = (m: Messages): string[] => [
    m.saved,
    m.notSaved,
    m.noSave(2027),
    m.noSaveCopy(2027, 2026),
    m.copyYear(2026),
    m.confirmDeleteYear(2026),
    m.confirmScale("1.500 €", "1.000 €"),
    m.confirmRemove("ING", "300 €"),
    m.confirmReset,
    m.usedOf("300 €", "1.000 €"),
    m.max("700 €"),
    m.resultsTitle(2026),
    m.confirmImport(2),
    m.imported(1),
    m.importInvalid,
    m.importNewer,
    m.importTooLarge,
    m.exported("freibetrag-rechner-2026-11-10.json"),
  ];

  it("has the same, non-empty texts in every language", () => {
    const keys = Object.keys(messagesFor("en").text).sort();
    for (const lang of LANGS) {
      const m = messagesFor(lang);
      expect(Object.keys(m.text).sort()).toEqual(keys);
      for (const value of [...(Object.values(m.text) as string[]), ...sample(m)])
        expect(value.trim()).not.toBe("");
    }
  });

  it("speaks German", () => {
    const de = messagesFor("de");
    expect(de.noSaveCopy(2027, 2026)).toBe(
      "Für 2027 ist noch nichts gespeichert. Mit der Verteilung von 2026 beginnen oder mit einer leeren Liste?",
    );
    expect(de.copyYear(2026)).toBe("2026 übernehmen");
    expect(de.confirmRemove("ING", "300 €")).toBe("„ING“ entfernen und 300 € freigeben?");
    expect(de.usedOf("300 €", "1.000 €")).toBe("300 € von 1.000 € verteilt");
    expect(de.max("700 €")).toBe("max. 700 €");
    expect(de.confirmImport(1)).toBe(
      "Alle auf diesem Gerät gespeicherten Jahre durch die Sicherung (1 Jahr) ersetzen? Das lässt sich nicht rückgängig machen.",
    );
    expect(de.imported(3)).toBe("3 Jahre aus der Sicherung wiederhergestellt.");
    expect(sample(messagesFor("en"))).not.toEqual(sample(de));
  });
});
