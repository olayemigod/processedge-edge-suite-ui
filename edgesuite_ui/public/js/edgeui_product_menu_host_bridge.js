(function installEdgeSuiteProductMenuHostBridge(global) {
  "use strict";

  const BRIDGE_ID = "edge-product-menu-navbar-bridge";
  const PRODUCT_MENU_HOST_ID = "edge-product-menu-host";
  const PRODUCT_MENU_TRIGGER_ID = "edge-product-menu-trigger";
  const PRODUCT_MENU_PANEL_ID = "edge-product-menu-dropdown";
  const PRODUCT_MENU_SLOT_ID = "edge-product-menu-slot";
  const MAX_ATTEMPTS = 40;
  const RETRY_MS = 150;
  const state = {
    installed: false,
    attempts: 0,
    mode: "",
    target: "",
  };

  function edgeShell(doc) {
    return doc?.querySelector?.(".edge-app-shell[data-edge-product]") || null;
  }

  function removeNativeArtifacts(doc) {
    if (edgeShell(doc)) return false;
    global.EdgeSuiteUI?.closeProductMenu?.();
    doc?.getElementById(BRIDGE_ID)?.remove();
    doc?.getElementById(PRODUCT_MENU_HOST_ID)?.remove();
    doc?.getElementById(PRODUCT_MENU_PANEL_ID)?.remove();
    doc?.getElementById(PRODUCT_MENU_SLOT_ID)?.remove();
    state.installed = false;
    state.mode = "native-desk-hidden";
    state.target = "";
    return true;
  }

  function ensureBridge() {
    const doc = global.document;
    if (!doc?.body) return false;

    const shell = edgeShell(doc);
    if (!shell) {
      removeNativeArtifacts(doc);
      return true;
    }

    doc.getElementById(BRIDGE_ID)?.remove();
    state.installed = true;
    state.mode = "edge-shell";
    state.target = ".edge-app-shell[data-edge-product]";
    global.EdgeSuiteUI?.mountProductMenu?.();
    return true;
  }

  function scheduleEnsure() {
    global.requestAnimationFrame?.(ensureBridge) || global.setTimeout(ensureBridge, 0);
  }

  function retryUntilReady() {
    state.attempts += 1;
    if (ensureBridge()) return;
    if (state.attempts < MAX_ATTEMPTS) {
      global.setTimeout(retryUntilReady, RETRY_MS);
    }
  }

  ["DOMContentLoaded", "toolbar_setup", "sidebar_setup", "desktop_screen", "page-change"].forEach(
    (eventName) => global.document?.addEventListener(eventName, scheduleEnsure),
  );
  global.frappe?.router?.on?.("change", scheduleEnsure);

  if (global.MutationObserver && global.document?.body) {
    const observer = new global.MutationObserver(() => {
      const shell = edgeShell(global.document);
      const trigger = global.document.getElementById(PRODUCT_MENU_TRIGGER_ID);
      if (!shell || !trigger) scheduleEnsure();
    });
    observer.observe(global.document.body, { childList: true, subtree: true });
    state.observer = observer;
  }

  global.EdgeSuiteProductMenuHostBridge = {
    ensure: ensureBridge,
    state,
  };

  retryUntilReady();
})(window);
