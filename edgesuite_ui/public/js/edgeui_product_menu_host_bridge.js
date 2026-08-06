(function installEdgeSuiteProductMenuHostBridge(global) {
  "use strict";

  const BRIDGE_ID = "edge-product-menu-navbar-bridge";
  const MAX_ATTEMPTS = 40;
  const RETRY_MS = 150;
  const state = {
    installed: false,
    attempts: 0,
    mode: "",
    target: "",
  };

  function isVisible(node) {
    if (!node || !node.isConnected) return false;
    const style = global.getComputedStyle?.(node);
    if (style?.display === "none" || style?.visibility === "hidden") return false;
    const box = node.getBoundingClientRect?.();
    return Boolean(box && box.width > 0 && box.height > 0);
  }

  function supportedNavbarExists(doc) {
    return Array.from(doc.querySelectorAll(".navbar, .desktop-navbar, header.navbar")).some(
      (node) => node.id !== BRIDGE_ID && isVisible(node),
    );
  }

  function firstVisible(doc, selectors) {
    for (const selector of selectors) {
      const nodes = Array.from(doc.querySelectorAll(selector));
      const match = nodes.find(isVisible);
      if (match) return { node: match, selector };
    }
    return null;
  }

  function resolveEmbeddedTarget(doc) {
    return firstVisible(doc, [
      ".desk-sidebar .sidebar-header",
      ".desk-sidebar .sidebar-menu",
      ".workspace-sidebar .sidebar-header",
      ".workspace-sidebar",
      ".body-sidebar .sidebar-header",
      ".body-sidebar",
      ".layout-side-section .sidebar-menu",
      ".layout-side-section",
      ".standard-sidebar",
      "aside[role='navigation']",
      "aside",
    ]);
  }

  function ensureBridge() {
    const doc = global.document;
    if (!doc?.body) return false;

    if (supportedNavbarExists(doc)) {
      doc.getElementById(BRIDGE_ID)?.remove();
      state.installed = false;
      state.mode = "native-navbar";
      state.target = "existing .navbar";
      global.EdgeSuiteUI?.mountProductMenu?.();
      return true;
    }

    let bridge = doc.getElementById(BRIDGE_ID);
    if (bridge && bridge.isConnected && isVisible(bridge)) {
      state.installed = true;
      global.EdgeSuiteUI?.mountProductMenu?.();
      return true;
    }

    bridge?.remove();
    bridge = doc.createElement("div");
    bridge.id = BRIDGE_ID;
    bridge.className = "navbar edge-product-menu-navbar-bridge";
    bridge.setAttribute("role", "navigation");
    bridge.setAttribute("aria-label", "EdgeSuite product navigation");

    const embedded = resolveEmbeddedTarget(doc);
    if (embedded) {
      bridge.classList.add("edge-product-menu-navbar-bridge--embedded");
      embedded.node.prepend(bridge);
      state.mode = "embedded";
      state.target = embedded.selector;
    } else {
      bridge.classList.add("edge-product-menu-navbar-bridge--floating");
      doc.body.appendChild(bridge);
      state.mode = "floating";
      state.target = "document.body";
    }

    state.installed = true;
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
      const trigger = global.document.getElementById("edge-product-menu-trigger");
      if (!trigger) scheduleEnsure();
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
