/**
 * UI layer: renders the store into the page and wires up user interaction.
 * All amount and year rules live in ./model.ts.
 */
import {
  type Holder,
  type Institution,
  type Mode,
  type Store,
  type YearState,
  LEGACY_KEY,
  STORAGE_KEY,
  HOLDERS,
  TOTALS,
  addInstitution,
  allocations,
  allocationsByHolder,
  cleanName,
  copyYear,
  createId,
  emptyYear,
  formatEuro,
  isHolder,
  isMode,
  maxFor,
  needsScaling,
  parseStore,
  previousSave,
  remainingOf,
  removeInstitution,
  renameHolder,
  setAmount,
  switchMode,
  totalOf,
  usedOf,
} from "./model";
import { type Lang, type Messages, LANG_KEY, detectLang, isLang, isStaticKey, messagesFor } from "./i18n";
import { APP_VERSION } from "./version";

/** Thumb diameter in px; must match `.slider .thumb` in index.html. */
const THUMB = 26;
/** Slider snapping in euros. */
const SLIDER_STEP = 10;

export interface AppOptions {
  storage?: Pick<Storage, "getItem" | "setItem">;
  /** Current calendar year, injectable for tests. */
  year?: number;
  /** Preferred languages, e.g. `navigator.languages`; used until the user picks one. */
  languages?: readonly string[];
}

/** `data-i18n-<name>` attribute → the attribute it fills with translated text. */
const I18N_ATTRS: readonly (readonly [string, string])[] = [
  ["data-i18n-label", "aria-label"],
  ["data-i18n-placeholder", "placeholder"],
  ["data-i18n-title", "title"],
];

export class App {
  private readonly store: Store;
  private readonly storage: Pick<Storage, "getItem" | "setItem"> | undefined;
  private lang: Lang;
  private t: Messages;

  constructor(
    private readonly doc: Document,
    options: AppOptions = {},
  ) {
    this.storage = options.storage;
    const year = options.year ?? new Date().getFullYear();
    let raw: string | null = null;
    let legacy: string | null = null;
    let lang: string | null = null;
    try {
      raw = this.storage?.getItem(STORAGE_KEY) ?? null;
      legacy = this.storage?.getItem(LEGACY_KEY) ?? null;
      lang = this.storage?.getItem(LANG_KEY) ?? null;
    } catch {
      // Storage can be unavailable (private mode, blocked site data): start fresh.
    }
    this.store = parseStore(raw, legacy, year);
    this.lang = isLang(lang) ? lang : detectLang(options.languages ?? []);
    this.t = messagesFor(this.lang);
  }

  get language(): Lang {
    return this.lang;
  }

  /** The save of the year being viewed, or null if that year has none yet. */
  get state(): YearState | null {
    return this.store.years[this.store.current] ?? null;
  }

  get currentYear(): number {
    return this.store.current;
  }

  private cur(): YearState {
    const state = this.state;
    if (!state) throw new Error(`No save for ${String(this.store.current)}`);
    return state;
  }

  private el(selector: string): HTMLElement;
  private el<T extends HTMLElement>(selector: string, type: new () => T): T;
  private el(selector: string, type: new () => HTMLElement = HTMLElement): HTMLElement {
    const found = this.doc.querySelector(selector);
    if (!(found instanceof type)) throw new Error(`Missing element ${selector}`);
    return found;
  }

  private confirm(message: string): boolean {
    return this.doc.defaultView?.confirm(message) ?? true;
  }

  save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch {
      // Ignore quota or availability errors; the UI keeps working in memory.
    }
  }

  // ---- actions -------------------------------------------------------------

  setLanguage(lang: Lang): void {
    this.lang = lang;
    this.t = messagesFor(lang);
    try {
      this.storage?.setItem(LANG_KEY, lang);
    } catch {
      // Not remembered across starts, but the switch still applies now.
    }
    this.translate();
    this.render();
  }

  goToYear(year: number): void {
    this.store.current = year;
    this.save();
    this.render();
  }

  startYear(from: number | null): void {
    const source = from === null ? undefined : this.store.years[from];
    this.store.years[this.store.current] = source ? copyYear(source, createId) : emptyYear();
    this.save();
    this.render();
  }

  deleteYear(): void {
    if (!this.state) return;
    if (!this.confirm(this.t.confirmDeleteYear(this.store.current))) return;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- years are keyed by number
    delete this.store.years[this.store.current];
    this.save();
    this.render();
  }

  setMode(mode: Mode): void {
    const state = this.cur();
    if (mode === state.mode) return;
    if (
      needsScaling(state, mode) &&
      !this.confirm(this.t.confirmScale(formatEuro(usedOf(state)), formatEuro(TOTALS[mode])))
    ) {
      this.render();
      return;
    }
    switchMode(state, mode);
    this.save();
    this.render();
  }

  add(name: string, holder: Holder = 0): void {
    if (addInstitution(this.cur(), name, createId(), holder)) {
      this.save();
      this.render();
    }
  }

  /** Renames a joint-mode account holder everywhere (holder pickers and results); blank names are ignored. */
  renameHolder(holder: Holder, name: string): void {
    if (renameHolder(this.cur(), holder, name)) this.save();
    this.render();
  }

  /** Assigns an institution to the other account holder. */
  setHolder(id: string, holder: Holder): void {
    const inst = this.cur().institutions.find((i) => i.id === id);
    if (!inst) return;
    inst.holder = holder;
    this.save();
    this.renderResults();
  }

  remove(id: string): void {
    const state = this.cur();
    const inst = state.institutions.find((i) => i.id === id);
    if (!inst) return;
    if (inst.amount > 0 && !this.confirm(this.t.confirmRemove(inst.name, formatEuro(inst.amount)))) return;
    removeInstitution(state, id);
    this.save();
    this.render();
  }

  resetAmounts(): void {
    const state = this.cur();
    if (state.institutions.length === 0 || !this.confirm(this.t.confirmReset)) return;
    for (const inst of state.institutions) inst.amount = 0;
    this.save();
    this.updateSummary();
  }

  private change(inst: Institution, value: number): void {
    setAmount(this.cur(), inst, value);
    this.updateSummary();
  }

  // ---- rendering -----------------------------------------------------------

  /** Fills every `data-i18n*` element (row template included) with the current language. */
  translate(): void {
    const text = this.t.text;
    this.doc.documentElement.lang = this.lang;
    const roots: ParentNode[] = [this.doc];
    for (const template of this.doc.querySelectorAll("template")) roots.push(template.content);
    for (const root of roots) {
      for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
        const key = String(el.dataset.i18n);
        if (isStaticKey(key)) el.textContent = text[key];
      }
      for (const [source, attr] of I18N_ATTRS) {
        for (const el of root.querySelectorAll(`[${source}]`)) {
          const key = String(el.getAttribute(source));
          if (isStaticKey(key)) el.setAttribute(attr, text[key]);
        }
      }
    }
    for (const btn of this.doc.querySelectorAll<HTMLButtonElement>("[data-lang]")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === this.lang));
    }
  }

  render(): void {
    const state = this.state;
    const year = this.store.current;
    this.el("#year").textContent = String(year);
    const saved = this.el("#year-saved");
    saved.textContent = state ? this.t.saved : this.t.notSaved;
    saved.classList.toggle("none", !state);
    this.el("#workspace").hidden = !state;
    this.el("#delete-year").hidden = !state;
    this.el("#start").hidden = !!state;
    this.el("#results").hidden = true;

    if (!state) {
      const prev = previousSave(this.store, year);
      this.el("#start-text").textContent =
        prev === null ? this.t.noSave(year) : this.t.noSaveCopy(year, prev);
      const fromBtn = this.el("#start-from");
      fromBtn.hidden = prev === null;
      fromBtn.textContent = prev === null ? "" : this.t.copyYear(prev);
      fromBtn.onclick = () => {
        this.startYear(prev);
      };
      return;
    }

    for (const radio of this.doc.querySelectorAll<HTMLInputElement>("input[name=mode]")) {
      radio.checked = radio.value === state.mode;
    }
    const joint = state.mode === "joint";
    this.el("#holders").hidden = !joint;
    for (const input of this.doc.querySelectorAll<HTMLInputElement>(".holder-name")) {
      const holder = Number(input.dataset.holder);
      if (!isHolder(holder)) continue;
      input.value = state.holders[holder];
      input.setAttribute("aria-label", this.t.holderName(holder + 1));
    }
    const addHolder = this.el("#add-holder", HTMLSelectElement);
    const picked = addHolder.value;
    this.fillHolders(addHolder, state);
    if (picked !== "") addHolder.value = picked;
    addHolder.hidden = !joint;
    this.el("#list").replaceChildren(...state.institutions.map((inst) => this.rowFor(inst)));
    this.el("#empty").hidden = state.institutions.length > 0;
    this.updateSummary();
  }

  /** Updates numbers in place without rebuilding rows, so focus and drags are kept. */
  updateSummary(): void {
    const state = this.cur();
    const total = totalOf(state);
    const used = usedOf(state);
    const remaining = remainingOf(state);
    this.el("#remaining").textContent = formatEuro(remaining);
    this.el("#used").textContent = this.t.usedOf(formatEuro(used), formatEuro(total));
    this.el("#bar-fill").style.width = `${String((used / total) * 100)}%`;
    this.el("#summary").classList.toggle("full", remaining === 0);

    for (const inst of state.institutions) {
      const row = this.doc.querySelector<HTMLElement>(`[data-id="${CSS.escape(inst.id)}"]`);
      if (!row) continue;
      const max = maxFor(state, inst);
      const slider = row.querySelector<HTMLElement>(".slider");
      if (slider) {
        slider.setAttribute("aria-valuemax", String(max));
        slider.setAttribute("aria-valuenow", String(inst.amount));
        slider.setAttribute("aria-valuetext", formatEuro(inst.amount));
        slider.style.setProperty("--fill", String(inst.amount / total));
        slider.style.setProperty("--cap", String(max / total));
      }
      const num = row.querySelector<HTMLInputElement>("input[type=number]");
      if (num) {
        if (this.doc.activeElement !== num) num.value = String(inst.amount);
        num.max = String(max);
      }
      const maxLabel = row.querySelector(".max");
      if (maxLabel) maxLabel.textContent = this.t.max(formatEuro(max));
    }
    this.renderResults();
  }

  /** Puts one option per account holder, named after them, into a holder picker. */
  private fillHolders(select: HTMLSelectElement, state: YearState): void {
    select.replaceChildren(
      ...HOLDERS.map((holder) => {
        const option = this.doc.createElement("option");
        option.value = String(holder);
        option.textContent = state.holders[holder];
        return option;
      }),
    );
  }

  private resultLine(label: string, value: number, className?: string): HTMLLIElement {
    const li = this.doc.createElement("li");
    if (className) li.className = className;
    const name = this.doc.createElement("span");
    name.textContent = label;
    const amount = this.doc.createElement("span");
    amount.className = "num";
    amount.textContent = formatEuro(value);
    li.append(name, amount);
    return li;
  }

  /**
   * Summary of what to send where: non-zero amounts only. In joint mode it is grouped by
   * account holder, with a subtotal per person; the overall total stays the same.
   */
  private renderResults(): void {
    const state = this.cur();
    const items = allocations(state);
    const joint = state.mode === "joint";
    this.el("#results").hidden = items.length === 0;
    this.el("#results-title").textContent = this.t.resultsTitle(this.store.current);
    const list = this.el("#results-list");
    list.classList.toggle("grouped", joint);
    list.replaceChildren(
      ...(joint
        ? allocationsByHolder(state).flatMap((group) => [
            this.resultLine(group.name, group.total, "group"),
            ...group.items.map((inst) => this.resultLine(inst.name, inst.amount)),
          ])
        : items.map((inst) => this.resultLine(inst.name, inst.amount))),
    );
    this.el("#results-total").textContent = formatEuro(usedOf(state));
  }

  private rowFor(inst: Institution): HTMLElement {
    const template = this.el("#row-template", HTMLTemplateElement);
    const row = (template.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
    row.dataset.id = inst.id;

    const name = row.querySelector<HTMLInputElement>(".name");
    if (name) {
      name.value = inst.name;
      name.addEventListener("change", () => {
        const clean = cleanName(name.value);
        if (clean !== null) {
          inst.name = clean;
          this.save();
          this.renderResults();
        }
        name.value = inst.name;
      });
    }

    const holder = row.querySelector<HTMLSelectElement>(".holder");
    if (holder) {
      const state = this.cur();
      this.fillHolders(holder, state);
      holder.value = String(inst.holder);
      holder.hidden = state.mode !== "joint";
      holder.addEventListener("change", () => {
        const value = Number(holder.value);
        if (isHolder(value)) this.setHolder(inst.id, value);
      });
    }

    row.querySelector(".del")?.addEventListener("click", () => {
      this.remove(inst.id);
    });

    const slider = row.querySelector<HTMLElement>(".slider");
    if (slider) this.attachSlider(slider, inst);

    const [minus, plus] = row.querySelectorAll<HTMLButtonElement>(".step");
    if (minus) this.attachStepper(minus, inst, -1);
    if (plus) this.attachStepper(plus, inst, 1);

    const num = row.querySelector<HTMLInputElement>("input[type=number]");
    if (num) {
      num.addEventListener("input", () => {
        if (num.value !== "") this.change(inst, Number(num.value));
      });
      num.addEventListener("change", () => {
        num.value = String(inst.amount);
        this.save();
      });
    }

    row.querySelector(".fill")?.addEventListener("click", () => {
      this.change(inst, maxFor(this.cur(), inst));
      this.save();
    });
    return row;
  }

  /**
   * Slider whose knob stays under the finger and moves in 10 € steps.
   * Tapping the track jumps there; grabbing the knob keeps the grab offset so it never jumps.
   * At the limit it stops at the exact remaining amount (e.g. 1.995 €).
   * Keyboard: arrows ±1 €, PageUp/PageDown ±10 €, Home/End to 0/max.
   */
  private attachSlider(el: HTMLElement, inst: Institution): void {
    let offset = 0;
    const valueAt = (clientX: number): number => {
      const rect = el.getBoundingClientRect();
      return ((clientX - rect.left - THUMB / 2) / (rect.width - THUMB)) * totalOf(this.cur());
    };
    const moveTo = (clientX: number): void => {
      const max = maxFor(this.cur(), inst);
      const value = valueAt(clientX) - offset;
      this.change(inst, value >= max ? max : Math.round(value / SLIDER_STEP) * SLIDER_STEP);
    };

    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.focus();
      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging");
      const thumb = el.querySelector(".thumb")?.getBoundingClientRect();
      const onThumb = !!thumb && e.clientX >= thumb.left - 8 && e.clientX <= thumb.right + 8;
      offset = onThumb ? valueAt(e.clientX) - inst.amount : 0;
      if (!onThumb) moveTo(e.clientX);
    });
    el.addEventListener("pointermove", (e) => {
      if (el.hasPointerCapture(e.pointerId)) moveTo(e.clientX);
    });
    const end = (e: PointerEvent): void => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.classList.remove("dragging");
      this.save();
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);

    el.addEventListener("keydown", (e) => {
      const value = keyTarget(e.key, inst.amount, maxFor(this.cur(), inst));
      if (value === null) return;
      e.preventDefault();
      this.change(inst, value);
      this.save();
    });
  }

  /** −/+ button that changes the amount by `delta`; holding it repeats, speeding up after a while. */
  private attachStepper(btn: HTMLButtonElement, inst: Institution, delta: number): void {
    const win = this.doc.defaultView;
    let timer: number | undefined;
    let count = 0;
    const step = (): void => {
      this.change(inst, inst.amount + delta);
    };
    const stop = (): void => {
      if (timer === undefined) return;
      win?.clearTimeout(timer);
      timer = undefined;
      this.save();
    };
    const repeat = (): void => {
      step();
      count++;
      timer = win?.setTimeout(repeat, count > 20 ? 30 : 90);
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      count = 0;
      step();
      timer = win?.setTimeout(repeat, 400);
    });
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
    // Keyboard activation (Enter/Space) produces a click with detail 0.
    btn.addEventListener("click", (e) => {
      if (e.detail === 0) {
        step();
        this.save();
      }
    });
  }

  /** Wires the static controls and renders the first view. */
  mount(): void {
    for (const radio of this.doc.querySelectorAll<HTMLInputElement>("input[name=mode]")) {
      radio.addEventListener("change", () => {
        if (radio.checked && isMode(radio.value)) this.setMode(radio.value);
      });
    }

    for (const field of this.doc.querySelectorAll<HTMLInputElement>(".holder-name")) {
      field.addEventListener("change", () => {
        const holder = Number(field.dataset.holder);
        if (isHolder(holder)) this.renameHolder(holder, field.value);
      });
    }

    const input = this.el("#add-name", HTMLInputElement);
    const addHolder = this.el("#add-holder", HTMLSelectElement);
    this.el("#add-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const holder = Number(addHolder.value);
      this.add(input.value, isHolder(holder) ? holder : 0);
      input.value = "";
      input.focus();
    });

    this.el("#prev-year").addEventListener("click", () => {
      this.goToYear(this.store.current - 1);
    });
    this.el("#next-year").addEventListener("click", () => {
      this.goToYear(this.store.current + 1);
    });
    this.el("#start-empty").addEventListener("click", () => {
      this.startYear(null);
    });
    this.el("#delete-year").addEventListener("click", () => {
      this.deleteYear();
    });
    this.el("#reset").addEventListener("click", () => {
      this.resetAmounts();
    });
    for (const btn of this.doc.querySelectorAll<HTMLButtonElement>("[data-lang]")) {
      btn.addEventListener("click", () => {
        if (isLang(btn.dataset.lang)) this.setLanguage(btn.dataset.lang);
      });
    }
    this.el("#version").textContent = `v${APP_VERSION}`;

    this.translate();
    this.render();
  }
}

/** Target amount for a slider key press, or null if the key is not handled. */
export function keyTarget(key: string, amount: number, max: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return amount + 1;
    case "ArrowLeft":
    case "ArrowDown":
      return amount - 1;
    case "PageUp":
      return amount + SLIDER_STEP;
    case "PageDown":
      return amount - SLIDER_STEP;
    case "Home":
      return 0;
    case "End":
      return max;
    default:
      return null;
  }
}
