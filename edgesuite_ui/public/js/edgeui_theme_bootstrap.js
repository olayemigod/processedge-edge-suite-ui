(() => {
  const STORAGE_PREFIX = "edgeui:theme:v1";
  const DEFAULT_PREFERENCE = {
    palette: "edge-blue",
    appearance: "light",
    autoLightStart: "06:00",
    autoDarkStart: "18:00",
  };
  const PALETTES = new Set(["edge-blue", "edge-indigo", "edge-teal", "edge-emerald", "edge-slate"]);
  const APPEARANCES = new Set(["light", "dark", "auto", "system"]);

  function currentUser() {
    const frappe = globalThis.frappe || {};
    return frappe.session?.user || frappe.boot?.user?.name || frappe.boot?.user?.email || "Guest";
  }

  function storageKey() {
    return `${STORAGE_PREFIX}:${currentUser()}`;
  }

  function validClock(value, fallback) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;
  }

  function normalizePreference(value = {}) {
    return {
      palette: PALETTES.has(value.palette) ? value.palette : DEFAULT_PREFERENCE.palette,
      appearance: APPEARANCES.has(value.appearance) ? value.appearance : DEFAULT_PREFERENCE.appearance,
      autoLightStart: validClock(value.autoLightStart, DEFAULT_PREFERENCE.autoLightStart),
      autoDarkStart: validClock(value.autoDarkStart, DEFAULT_PREFERENCE.autoDarkStart),
    };
  }

  function readPreference() {
    try {
      const raw = globalThis.localStorage?.getItem(storageKey());
      return normalizePreference(raw ? JSON.parse(raw) : {});
    } catch (_error) {
      return { ...DEFAULT_PREFERENCE };
    }
  }

  function minutes(value) {
    const [hour, minute] = validClock(value, "00:00").split(":").map(Number);
    return hour * 60 + minute;
  }

  function resolveAppearance(preference) {
    if (preference.appearance === "dark" || preference.appearance === "light") {
      return preference.appearance;
    }
    if (preference.appearance === "system") {
      return globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
    }

    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const lightStart = minutes(preference.autoLightStart);
    const darkStart = minutes(preference.autoDarkStart);

    if (lightStart === darkStart) return "light";
    if (lightStart < darkStart) {
      return current >= lightStart && current < darkStart ? "light" : "dark";
    }
    return current >= lightStart || current < darkStart ? "light" : "dark";
  }

  const preference = readPreference();
  const root = globalThis.document?.documentElement;
  if (!root) return;

  root.dataset.edgePalette = preference.palette;
  root.dataset.edgeAppearanceMode = preference.appearance;
  root.dataset.edgeAppearance = resolveAppearance(preference);
  root.style.colorScheme = root.dataset.edgeAppearance;
})();
