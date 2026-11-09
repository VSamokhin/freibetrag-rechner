import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, keyTarget } from "../src/app";
import { LANG_KEY } from "../src/i18n";
import { STORAGE_KEY, type Store } from "../src/model";

const html = readFileSync(resolve(__dirname, "../public/index.html"), "utf8");
const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string): T[] => [...document.querySelectorAll<T>(sel)];
/** Intl puts a no-break space before €; compare with plain spaces. */
const plain = (text: string | null | undefined): string => (text ?? "").replace(/\s/g, " ");
const amounts = (): string[] => $$<HTMLInputElement>("#list input[type=number]").map((i) => i.value);

function addBank(name: string): void {
  $<HTMLInputElement>("#add-name").value = name;
  $<HTMLFormElement>("#add-form").dispatchEvent(new Event("submit", { cancelable: true }));
}

function typeAmount(index: number, value: string): void {
  const input = $$<HTMLInputElement>("#list input[type=number]")[index]!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
  input.dispatchEvent(new Event("change"));
}

let storage: MemoryStorage;
let app: App;
let confirmSpy: MockInstance<(message?: string) => boolean>;

function mount(year = 2026): void {
  document.body.innerHTML = body;
  app = new App(document, { storage, year });
  app.mount();
}

const saved = (): Store => JSON.parse(storage.getItem(STORAGE_KEY)!) as Store;

beforeEach(() => {
  storage = new MemoryStorage();
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  mount();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("app", () => {
  it("shows the version and the full free balance initially", () => {
    expect($("#version").textContent).toMatch(/^v\d+\.\d+\.\d+/);
    expect($("#remaining").textContent).toContain("1.000");
    expect($("#empty").hidden).toBe(false);
  });

  it("adds banks and caps amounts at the free balance", () => {
    addBank("ING");
    addBank("DKB");
    addBank("  ");
    expect($$(".inst")).toHaveLength(2);
    typeAmount(0, "700");
    typeAmount(1, "900");
    expect(amounts()).toEqual(["700", "300"]);
    expect($("#remaining").textContent).toContain("0");
    expect($("#summary").classList.contains("full")).toBe(true);
    expect(saved().years["2026"]!.institutions.map((i) => i.amount)).toEqual([700, 300]);
  });

  it("assigns the rest with the + rest button", () => {
    addBank("ING");
    addBank("DKB");
    typeAmount(0, "250");
    $$("#list .fill")[1]!.click();
    expect(amounts()).toEqual(["250", "750"]);
  });

  it("changes amounts by 1 € with the stepper buttons and keyboard", () => {
    addBank("ING");
    const [minus, plus] = $$<HTMLButtonElement>("#list .step");
    plus!.click();
    plus!.click();
    minus!.click();
    expect(amounts()).toEqual(["1"]);
    const slider = $(".slider");
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp" }));
    expect(amounts()).toEqual(["11"]);
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "End" }));
    expect(amounts()).toEqual(["1000"]);
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    expect(slider.getAttribute("aria-valuenow")).toBe("1000");
  });

  it("lists only non-zero allocations in the results", () => {
    addBank("ING");
    addBank("DKB");
    expect($("#results").hidden).toBe(true);
    typeAmount(1, "400");
    expect($("#results").hidden).toBe(false);
    expect($$("#results-list li").map((li) => li.textContent.replace(/\s/g, " "))).toEqual(["DKB400 €"]);
    expect($("#results-title").textContent).toBe("Freistellungsaufträge 2026");
  });

  it("renames and removes banks", () => {
    addBank("ING");
    const name = $<HTMLInputElement>(".name");
    name.value = "  ING DiBa ";
    name.dispatchEvent(new Event("change"));
    expect(saved().years["2026"]!.institutions[0]!.name).toBe("ING DiBa");
    name.value = "";
    name.dispatchEvent(new Event("change"));
    expect(name.value).toBe("ING DiBa");
    typeAmount(0, "100");
    confirmSpy.mockReturnValueOnce(false);
    $(".del").click();
    expect($$(".inst")).toHaveLength(1);
    $(".del").click();
    expect($$(".inst")).toHaveLength(0);
  });

  it("switches to joint and scales down when switching back, if confirmed", () => {
    addBank("ING");
    const joint = $<HTMLInputElement>("#m-joint");
    joint.checked = true;
    joint.dispatchEvent(new Event("change"));
    typeAmount(0, "1600");
    const single = $<HTMLInputElement>("#m-single");
    confirmSpy.mockReturnValueOnce(false);
    single.checked = true;
    single.dispatchEvent(new Event("change"));
    expect(app.state?.mode).toBe("joint");
    expect(joint.checked).toBe(true);
    single.checked = true;
    single.dispatchEvent(new Event("change"));
    expect(app.state?.mode).toBe("single");
    expect(amounts()).toEqual(["1000"]);
  });

  it("resets all amounts", () => {
    addBank("ING");
    typeAmount(0, "300");
    $("#reset").click();
    expect(amounts()).toEqual(["0"]);
  });

  it("starts a new year from the previous save or empty, and deletes years", () => {
    addBank("ING");
    typeAmount(0, "300");
    $("#next-year").click();
    expect($("#year").textContent).toBe("2027");
    expect($("#workspace").hidden).toBe(true);
    expect($("#start-from").textContent).toBe("Copy 2026");
    $("#start-from").click();
    expect(amounts()).toEqual(["300"]);
    typeAmount(0, "500");
    $("#prev-year").click();
    expect(amounts()).toEqual(["300"]);

    $("#prev-year").click();
    expect($("#start-from").hidden).toBe(true);
    $("#start-empty").click();
    expect($$(".inst")).toHaveLength(0);
    $("#delete-year").click();
    expect($("#year-saved").textContent).toBe("no save yet");
    expect(Object.keys(saved().years)).toEqual(["2026", "2027"]);
  });

  it("restores the saved state on the next start", () => {
    addBank("ING");
    typeAmount(0, "123");
    mount();
    expect(amounts()).toEqual(["123"]);
  });

  it("keeps working when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    document.body.innerHTML = body;
    const a = new App(document, { storage: broken, year: 2026 });
    a.mount();
    addBank("ING");
    expect($$(".inst")).toHaveLength(1);
  });

  it("fails loudly if the page is missing required elements", () => {
    document.body.innerHTML = "";
    expect(() => {
      new App(document, { storage, year: 2026 }).mount();
    }).toThrow(/Missing element/);
  });
});

describe("language", () => {
  function mountWith(languages: readonly string[]): void {
    document.body.innerHTML = body;
    app = new App(document, { storage, year: 2026, languages });
    app.mount();
  }

  it("defaults to English and follows a German browser", () => {
    expect(app.language).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    mountWith(["de-DE", "en"]);
    expect(app.language).toBe("de");
    expect(document.documentElement.lang).toBe("de");
    expect($("#summary .label").textContent).toBe("Noch verfügbar");
    expect($('[data-lang="de"]').getAttribute("aria-pressed")).toBe("true");
    expect($('[data-lang="en"]').getAttribute("aria-pressed")).toBe("false");
  });

  it("switches the whole page, rows included, and remembers the choice", () => {
    addBank("ING");
    typeAmount(0, "300");
    $('[data-lang="de"]').click();
    expect(storage.getItem(LANG_KEY)).toBe("de");
    expect($("#add-form button").textContent).toBe("Hinzufügen");
    expect($("#add-name").getAttribute("placeholder")).toBe("Bank oder Broker");
    expect($("#prev-year").getAttribute("aria-label")).toBe("Vorheriges Jahr");
    expect(plain($("#used").textContent)).toBe("300 € von 1.000 € verteilt");
    expect($("#year-saved").textContent).toBe("gespeichert");
    expect($(".inst .fill").textContent).toBe("+ Rest");
    expect($(".inst .fill").getAttribute("title")).toBe("Den ganzen Rest diesem Institut zuweisen");
    expect(plain($(".inst .max").textContent)).toBe("max. 1.000 €");
    expect($(".inst .del").getAttribute("aria-label")).toBe("Institut entfernen");
    expect($<HTMLInputElement>(".inst .name").value).toBe("ING");
    expect(amounts()).toEqual(["300"]);

    mountWith(["en"]);
    expect(app.language).toBe("de");
    $("#next-year").click();
    expect($("#start-from").textContent).toBe("2026 übernehmen");
    expect($("#year-saved").textContent).toBe("noch nicht gespeichert");

    $('[data-lang="en"]').click();
    expect($("#start-from").textContent).toBe("Copy 2026");
    expect($("#start-empty").textContent).toBe("Start empty");
  });

  it("asks for confirmation in the chosen language", () => {
    $('[data-lang="de"]').click();
    addBank("ING");
    typeAmount(0, "300");
    $(".del").click();
    expect(plain(confirmSpy.mock.lastCall?.[0])).toBe("„ING“ entfernen und 300 € freigeben?");
  });

  it("leaves elements with unknown keys or languages alone", () => {
    document.body.innerHTML =
      body +
      '<p id="x" data-i18n="nope" data-i18n-title="nope">keep</p><button id="y" data-lang="fr">FR</button>';
    app = new App(document, { storage, year: 2026 });
    app.mount();
    $("#y").click();
    expect(app.language).toBe("en");
    expect($("#x").textContent).toBe("keep");
    expect($("#x").hasAttribute("title")).toBe(false);
  });

  it("ignores an unknown stored language", () => {
    storage.setItem(LANG_KEY, "fr");
    mountWith(["de"]);
    expect(app.language).toBe("de");
  });

  it("still switches when storage throws", () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    };
    document.body.innerHTML = body;
    const a = new App(document, { storage: broken, year: 2026 });
    a.mount();
    a.setLanguage("de");
    expect(a.language).toBe("de");
    expect($("#reset").textContent).toBe("Beträge zurücksetzen");
  });
});

describe("pointer interaction", () => {
  const captured = new Set<number>();
  const pointer = (type: string, clientX = 0): Event => {
    const e = new MouseEvent(type, { clientX, bubbles: true, cancelable: true });
    Object.defineProperty(e, "pointerId", { value: 1 });
    return e;
  };

  beforeEach(() => {
    captured.clear();
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: (id: number) => captured.add(id),
      releasePointerCapture: (id: number) => captured.delete(id),
      hasPointerCapture: (id: number) => captured.has(id),
    });
    addBank("ING");
    addBank("DKB");
  });

  /** Track 226 px wide plus 26 px thumb: 1 px ≈ 4.42 € in single mode. */
  function layout(slider: HTMLElement): void {
    slider.getBoundingClientRect = () => ({ left: 0, width: 252 }) as DOMRect;
    const thumb = slider.querySelector<HTMLElement>(".thumb")!;
    thumb.getBoundingClientRect = () => {
      const x = (Number(slider.style.getPropertyValue("--fill")) || 0) * 226;
      return { left: x, right: x + 26 } as DOMRect;
    };
  }

  it("jumps to a tapped position rounded to 10 € and follows the drag", () => {
    const slider = $$(".slider")[0]!;
    layout(slider);
    slider.dispatchEvent(pointer("pointerdown", 13 + 113)); // middle of the track → 500 €
    expect(amounts()[0]).toBe("500");
    expect(slider.classList.contains("dragging")).toBe(true);
    slider.dispatchEvent(pointer("pointermove", 13 + 113 + 22)); // +22 px ≈ +97 € → 600 €
    expect(amounts()[0]).toBe("600");
    slider.dispatchEvent(pointer("pointerup"));
    expect(slider.classList.contains("dragging")).toBe(false);
    slider.dispatchEvent(pointer("pointermove", 0)); // no capture any more → ignored
    expect(amounts()[0]).toBe("600");
  });

  it("stops at the exact free balance when dragged past it", () => {
    typeAmount(1, "5");
    const slider = $$(".slider")[0]!;
    layout(slider);
    slider.dispatchEvent(pointer("pointerdown", 500));
    expect(amounts()[0]).toBe("995");
    slider.dispatchEvent(pointer("pointercancel"));
  });

  it("keeps the grab offset when the thumb itself is dragged", () => {
    typeAmount(0, "300");
    const slider = $$(".slider")[0]!;
    layout(slider);
    const x = 0.3 * 226 + 20; // on the thumb, slightly right of its centre
    slider.dispatchEvent(pointer("pointerdown", x));
    expect(amounts()[0]).toBe("300");
    slider.dispatchEvent(pointer("pointermove", x + 45)); // ≈ +199 € → 500 €
    expect(amounts()[0]).toBe("500");
  });

  it("repeats while a stepper button is held", () => {
    vi.useFakeTimers();
    const plus = $$<HTMLButtonElement>("#list .step")[1]!;
    plus.dispatchEvent(pointer("pointerdown"));
    vi.advanceTimersByTime(400 + 90 * 25);
    plus.dispatchEvent(pointer("pointerup"));
    const held = Number(amounts()[0]);
    expect(held).toBeGreaterThan(20);
    vi.advanceTimersByTime(1000);
    expect(Number(amounts()[0])).toBe(held);
    plus.dispatchEvent(pointer("pointercancel"));
    const menu = new MouseEvent("contextmenu", { cancelable: true });
    plus.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    vi.useRealTimers();
  });
});

describe("keyTarget", () => {
  it.each([
    ["ArrowRight", 51],
    ["ArrowUp", 51],
    ["ArrowLeft", 49],
    ["ArrowDown", 49],
    ["PageUp", 60],
    ["PageDown", 40],
    ["Home", 0],
    ["End", 300],
    ["Tab", null],
  ])("%s → %s", (key, expected) => {
    expect(keyTarget(key, 50, 300)).toBe(expected);
  });
});
