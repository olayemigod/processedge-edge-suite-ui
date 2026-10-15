function getFrappeUI(target = globalThis) {
  return target?.frappe?.ui || null;
}

export function detectFrappeDeskUICapabilities(target = globalThis) {
  const ui = getFrappeUI(target);
  return Object.freeze({
    dropdown: Boolean(ui && (typeof ui.Dropdown === "function" || typeof ui.dropdown === "function")),
    contextMenu: Boolean(ui && typeof ui.ContextMenu === "function"),
    toast: Boolean(ui && typeof ui.toast === "function"),
  });
}

export function createFrappeDeskUIAdapter({ target = globalThis } = {}) {
  return Object.freeze({
    capabilities() {
      return detectFrappeDeskUICapabilities(target);
    },

    isAvailable(capability) {
      return Boolean(this.capabilities()[capability]);
    },

    dropdown(options = {}) {
      const ui = getFrappeUI(target);
      if (!ui) return null;
      if (typeof ui.Dropdown === "function") return new ui.Dropdown(options);
      if (typeof ui.dropdown === "function") return ui.dropdown(options);
      return null;
    },

    contextMenu(options = {}) {
      const ui = getFrappeUI(target);
      if (!ui || typeof ui.ContextMenu !== "function") return null;
      return new ui.ContextMenu(options);
    },

    toast(options = {}) {
      const ui = getFrappeUI(target);
      if (!ui || typeof ui.toast !== "function") return null;
      return ui.toast(options);
    },
  });
}
