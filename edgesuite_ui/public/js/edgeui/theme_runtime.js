const STORAGE_PREFIX = "edgeui:theme:v1";
const THEME_EVENT = "edgesuite:theme-changed";
const THEME_MENU_CLASS = "edge-theme-menu";

export const EDGE_THEME_PALETTES = Object.freeze([
  { id: "edge-blue", label: "Edge Blue" },
  { id: "edge-indigo", label: "Edge Indigo" },
  { id: "edge-teal", label: "Edge Teal" },
  { id: "edge-emerald", label: "Edge Emerald" },
  { id: "edge-slate", label: "Edge Slate" },
]);

export const EDGE_THEME_APPEARANCES = Object.freeze([
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
  { id: "system", label: "System" },
]);

export const EDGE_THEME_DEFAULT = Object.freeze({
  palette: "edge-blue",
  appearance: "light",
  autoLightStart: "06:00",
  autoDarkStart: "18:00",
});

const paletteIds = new Set(EDGE_THEME_PALETTES.map((item) => item.id));
const appearanceIds = new Set(EDGE_THEME_APPEARANCES.map((item) => item.id));

function currentUser(target) {
  return target?.frappe?.session?.user || "";
}

function storageKey(target) {
  const user = currentUser(target);
  return user ? `${STORAGE_PREFIX}:${user}` : `${STORAGE_PREFIX}:last`;
}

function validClock(value, fallback) {
  const text = String(value || "");
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

export function normalizeThemePreference(value = {}) {
  return {
    palette: paletteIds.has(value.palette) ? value.palette : EDGE_THEME_DEFAULT.palette,
    appearance: appearanceIds.has(value.appearance)
      ? value.appearance
      : EDGE_THEME_DEFAULT.appearance,
    autoLightStart: validClock(value.autoLightStart, EDGE_THEME_DEFAULT.autoLightStart),
    autoDarkStart: validClock(value.autoDarkStart, EDGE_THEME_DEFAULT.autoDarkStart),
  };
}

function clockMinutes(value) {
  const [hour, minute] = validClock(value, "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

export function resolveThemeAppearance(preference, target = globalThis, now = new Date()) {
  const normalized = normalizeThemePreference(preference);
  if (normalized.appearance === "light" || normalized.appearance === "dark") {
    return normalized.appearance;
  }
  if (normalized.appearance === "system") {
    return target?.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  const current = now.getHours() * 60 + now.getMinutes();
  const lightStart = clockMinutes(normalized.autoLightStart);
  const darkStart = clockMinutes(normalized.autoDarkStart);
  if (lightStart === darkStart) return "light";
  if (lightStart < darkStart) {
    return current >= lightStart && current < darkStart ? "light" : "dark";
  }
  return current >= lightStart || current < darkStart ? "light" : "dark";
}

function readStoredPreference(target) {
  try {
    const key = storageKey(target);
    let raw = target?.localStorage?.getItem(key);
    if (!raw && currentUser(target)) raw = target?.localStorage?.getItem(`${STORAGE_PREFIX}:last`);
    return normalizeThemePreference(raw ? JSON.parse(raw) : {});
  } catch (_error) {
    return { ...EDGE_THEME_DEFAULT };
  }
}

function writeStoredPreference(target, preference) {
  try {
    const payload = JSON.stringify(preference);
    target?.localStorage?.setItem(storageKey(target), payload);
    if (currentUser(target)) target?.localStorage?.setItem(`${STORAGE_PREFIX}:last`, payload);
  } catch (_error) {
    // Theme selection must remain usable when browser storage is unavailable.
  }
}

function dispatchThemeChanged(target, preference, resolvedAppearance) {
  if (typeof target?.CustomEvent !== "function") return;
  target.dispatchEvent?.(
    new target.CustomEvent(THEME_EVENT, {
      detail: { ...preference, resolvedAppearance },
    }),
  );
}

function createChoiceButton(document, item, active, onClick, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `edge-theme-menu__choice ${extraClass}`.trim();
  button.dataset.value = item.id;
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.textContent = item.label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick(item.id);
  });
  return button;
}

function installThemeMenu(controller, target) {
  const document = target?.document;
  if (!document?.body) return () => {};

  function renderMenu() {
    const items = document.querySelector(".edge-user-menu .edge-user-menu__items");
    if (!items || items.querySelector(`.${THEME_MENU_CLASS}`)) return;

    const preference = controller.getPreference();
    const wrapper = document.createElement("div");
    wrapper.className = THEME_MENU_CLASS;
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-label", "Theme preferences");

    const appearanceSection = document.createElement("div");
    appearanceSection.className = "edge-theme-menu__section";
    const appearanceLabel = document.createElement("span");
    appearanceLabel.className = "edge-theme-menu__label";
    appearanceLabel.textContent = "Appearance";
    const appearanceChoices = document.createElement("div");
    appearanceChoices.className = "edge-theme-menu__choices";
    EDGE_THEME_APPEARANCES.forEach((item) => {
      appearanceChoices.appendChild(
        createChoiceButton(document, item, preference.appearance === item.id, (value) => {
          controller.setAppearance(value);
          wrapper.remove();
          renderMenu();
        }),
      );
    });
    appearanceSection.append(appearanceLabel, appearanceChoices);

    const paletteSection = document.createElement("div");
    paletteSection.className = "edge-theme-menu__section";
    const paletteLabel = document.createElement("span");
    paletteLabel.className = "edge-theme-menu__label";
    paletteLabel.textContent = "Theme";
    const paletteChoices = document.createElement("div");
    paletteChoices.className = "edge-theme-menu__palette-list";
    EDGE_THEME_PALETTES.forEach((item) => {
      const button = createChoiceButton(
        document,
        item,
        preference.palette === item.id,
        (value) => {
          controller.setPalette(value);
          wrapper.remove();
          renderMenu();
        },
        "edge-theme-menu__palette-choice",
      );
      const swatch = document.createElement("span");
      swatch.className = "edge-theme-menu__swatch";
      swatch.dataset.palette = item.id;
      swatch.setAttribute("aria-hidden", "true");
      button.prepend(swatch);
      paletteChoices.appendChild(button);
    });
    paletteSection.append(paletteLabel, paletteChoices);

    const status = document.createElement("small");
    status.className = "edge-theme-menu__status";
    status.textContent = preference.appearance === "auto"
      ? `Auto · ${controller.getResolvedAppearance()} now`
      : preference.appearance === "system"
        ? `System · ${controller.getResolvedAppearance()} now`
        : `${controller.getResolvedAppearance()} appearance`;

    wrapper.append(appearanceSection, paletteSection, status);
    const children = [...items.children];
    const insertionPoint = children.find((node) => node.classList?.contains("edge-user-menu__logout"));
    items.insertBefore(wrapper, insertionPoint || null);
  }

  const observer = target.MutationObserver
    ? new target.MutationObserver((records) => {
        if (records.some((record) => record.addedNodes?.length || record.removedNodes?.length)) {
          renderMenu();
        }
      })
    : null;
  observer?.observe(document.body, { childList: true, subtree: true });
  target.addEventListener?.(THEME_EVENT, renderMenu);
  renderMenu();

  return () => {
    observer?.disconnect();
    target.removeEventListener?.(THEME_EVENT, renderMenu);
  };
}

export function createThemeController(target = globalThis) {
  let preference = readStoredPreference(target);
  let resolvedAppearance = resolveThemeAppearance(preference, target);
  const listeners = new Set();
  let autoTimer = null;
  let mediaQuery = null;

  function apply({ persist = false, notify = true } = {}) {
    preference = normalizeThemePreference(preference);
    resolvedAppearance = resolveThemeAppearance(preference, target);
    const root = target?.document?.documentElement;
    if (root) {
      root.dataset.edgePalette = preference.palette;
      root.dataset.edgeAppearanceMode = preference.appearance;
      root.dataset.edgeAppearance = resolvedAppearance;
      root.style.colorScheme = resolvedAppearance;
    }
    if (persist) writeStoredPreference(target, preference);
    if (notify) {
      const snapshot = { ...preference, resolvedAppearance };
      listeners.forEach((listener) => listener(snapshot));
      dispatchThemeChanged(target, preference, resolvedAppearance);
    }
    scheduleAutoRefresh();
    return { ...preference, resolvedAppearance };
  }

  function scheduleAutoRefresh() {
    if (autoTimer) target?.clearTimeout?.(autoTimer);
    autoTimer = null;
    if (preference.appearance !== "auto") return;
    const now = new Date();
    const delay = Math.max(1000, 60000 - now.getSeconds() * 1000 - now.getMilliseconds());
    autoTimer = target?.setTimeout?.(() => apply({ notify: true }), delay) || null;
  }

  function setPreference(next) {
    preference = normalizeThemePreference({ ...preference, ...next });
    return apply({ persist: true, notify: true });
  }

  function handleStorage(event) {
    const keys = new Set([storageKey(target), `${STORAGE_PREFIX}:last`]);
    if (!keys.has(event?.key)) return;
    preference = readStoredPreference(target);
    apply({ persist: false, notify: true });
  }

  function handleSystemAppearanceChange() {
    if (preference.appearance === "system") apply({ persist: false, notify: true });
  }

  target?.addEventListener?.("storage", handleStorage);
  mediaQuery = target?.matchMedia?.("(prefers-color-scheme: dark)") || null;
  mediaQuery?.addEventListener?.("change", handleSystemAppearanceChange);
  mediaQuery?.addListener?.(handleSystemAppearanceChange);

  const controller = {
    palettes: EDGE_THEME_PALETTES,
    appearances: EDGE_THEME_APPEARANCES,
    getPreference() {
      return { ...preference };
    },
    getResolvedAppearance() {
      return resolvedAppearance;
    },
    setAppearance(appearance) {
      return setPreference({ appearance });
    },
    setPalette(palette) {
      return setPreference({ palette });
    },
    setAutoSchedule({ lightStart, darkStart } = {}) {
      return setPreference({
        autoLightStart: validClock(lightStart, preference.autoLightStart),
        autoDarkStart: validClock(darkStart, preference.autoDarkStart),
      });
    },
    reset() {
      preference = { ...EDGE_THEME_DEFAULT };
      return apply({ persist: true, notify: true });
    },
    apply() {
      return apply({ persist: false, notify: true });
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("Theme listener must be a function");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (autoTimer) target?.clearTimeout?.(autoTimer);
      target?.removeEventListener?.("storage", handleStorage);
      mediaQuery?.removeEventListener?.("change", handleSystemAppearanceChange);
      mediaQuery?.removeListener?.(handleSystemAppearanceChange);
      listeners.clear();
    },
  };

  controller.apply();
  return controller;
}

export function installThemeRuntime(runtime, target = globalThis) {
  if (!runtime || runtime.theme) return runtime?.theme || null;
  const controller = createThemeController(target);
  runtime.theme = controller;
  runtime.getThemePreference = () => controller.getPreference();
  runtime.getResolvedThemeAppearance = () => controller.getResolvedAppearance();
  runtime.setThemeAppearance = (appearance) => controller.setAppearance(appearance);
  runtime.setThemePalette = (palette) => controller.setPalette(palette);
  runtime.setThemeAutoSchedule = (schedule) => controller.setAutoSchedule(schedule);
  runtime.resetThemePreference = () => controller.reset();
  runtime.onThemeChange = (listener) => controller.subscribe(listener);
  runtime.__destroyThemeMenu = installThemeMenu(controller, target);
  return controller;
}

export { STORAGE_PREFIX, THEME_EVENT, THEME_MENU_CLASS };
