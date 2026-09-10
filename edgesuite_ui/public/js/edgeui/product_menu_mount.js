const HOST_ID = "edge-product-menu-host";
const PANEL_ID = "edge-product-menu-dropdown";
const TRIGGER_ID = "edge-product-menu-trigger";
const SLOT_ID = "edge-product-menu-slot";
const BRIDGE_ID = "edge-product-menu-navbar-bridge";
const DIRECT_HANDLER_KEY = "__edgeSuiteProductMenuDirectHandler";
const DELEGATED_HANDLER_KEY = "__edgeSuiteProductMenuDelegatedHandler";

function visibleElement(element) {
  if (!element?.isConnected) return false;
  const view = element.ownerDocument?.defaultView;
  let current = element;
  while (current?.nodeType === 1) {
    if (current.hidden || current.getAttribute?.("aria-hidden") === "true") return false;
    const style = view?.getComputedStyle?.(current);
    if (
      style?.visibility === "hidden" ||
      style?.display === "none" ||
      style?.contentVisibility === "hidden"
    ) {
      return false;
    }
    current = current.parentElement;
  }
  const rects = element.getClientRects?.();
  if (rects?.length) return true;
  const box = element.getBoundingClientRect?.();
  return Boolean(box && box.width > 0 && box.height > 0);
}

function edgeShellPresent(document) {
  return Array.from(document.querySelectorAll(".edge-app-shell[data-edge-product]")).some(
    visibleElement,
  );
}

function stabilizeSlot(slot) {
  if (!slot) return null;
  slot.hidden = false;
  slot.classList.add("edge-product-menu-slot", "navbar");
  slot.classList.remove("edge-product-menu-slot--fallback");
  slot.style.display = "inline-flex";
  slot.style.alignItems = "center";
  slot.style.flex = "0 0 auto";
  slot.style.minWidth = "2rem";
  slot.style.minHeight = "2rem";
  slot.style.padding = "0";
  slot.style.pointerEvents = "auto";
  slot.style.position = "relative";
  slot.style.right = "";
  slot.style.top = "";
  slot.style.zIndex = "4";
  slot.style.order = "";
  slot.style.margin = "0 0 0 0.35rem";
  return slot;
}

function shellProductNavigationTarget(document) {
  const selectors = [
    ".edge-app-shell[data-edge-product] .edge-app-shell__topbar .edge-topbar__brand",
    ".edge-app-shell[data-edge-product] .edge-topbar__brand",
    ".edge-app-shell[data-edge-product] .edge-app-shell__topbar .edge-topbar-actions",
    ".edge-app-shell[data-edge-product] .edge-topbar-actions",
  ];
  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector)).reverse();
    const target = nodes.find(visibleElement);
    if (target) return target;
  }
  return null;
}

function ensureShellSlot(document) {
  const target = shellProductNavigationTarget(document);
  if (!target) return null;
  let slot = document.getElementById(SLOT_ID);
  if (!slot) {
    slot = document.createElement("span");
    slot.id = SLOT_ID;
  }
  stabilizeSlot(slot);
  if (slot.parentElement !== target) target.appendChild(slot);
  return slot;
}

function removeNativeMenuArtifacts(document, closeMenu = null) {
  if (edgeShellPresent(document)) return false;
  if (typeof closeMenu === "function") closeMenu();
  document.getElementById(HOST_ID)?.remove();
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(SLOT_ID)?.remove();
  document.getElementById(BRIDGE_ID)?.remove();
  return true;
}

function preferredTarget(document) {
  if (!edgeShellPresent(document)) return null;
  return ensureShellSlot(document);
}

function stabilizeTrigger(document) {
  const trigger = document.getElementById(TRIGGER_ID);
  if (!trigger) return null;
  trigger.hidden = false;
  trigger.style.display = "inline-flex";
  trigger.style.position = "relative";
  trigger.style.zIndex = "5";
  trigger.style.pointerEvents = "auto";
  return trigger;
}

function bindDirectTrigger(document, toggleMenu) {
  const trigger = stabilizeTrigger(document);
  if (!trigger || typeof toggleMenu !== "function") return trigger;

  const existing = trigger[DIRECT_HANDLER_KEY];
  if (existing) trigger.removeEventListener("click", existing, true);

  const handler = (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleMenu();
  };

  trigger.addEventListener("click", handler, true);
  trigger[DIRECT_HANDLER_KEY] = handler;
  return trigger;
}

function bindDelegatedTrigger(document, toggleMenu) {
  if (!document || typeof toggleMenu !== "function") return;
  const existing = document[DELEGATED_HANDLER_KEY];
  if (existing) document.removeEventListener("click", existing, true);

  const handler = (event) => {
    const trigger = event.target?.closest?.(`#${TRIGGER_ID}`);
    if (!trigger || !trigger.isConnected) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleMenu();
  };

  document.addEventListener("click", handler, true);
  document[DELEGATED_HANDLER_KEY] = handler;
}

function moveHost(document, toggleMenu = null) {
  const host = document.getElementById(HOST_ID);
  const target = preferredTarget(document);
  if (!host || !target) return false;
  if (host.parentElement !== target) target.appendChild(host);
  host.style.position = "relative";
  host.style.zIndex = "4";
  host.style.pointerEvents = "auto";
  bindDirectTrigger(document, toggleMenu);
  return true;
}

function emitMenuOpened(target) {
  if (typeof target?.CustomEvent !== "function") return;
  target.dispatchEvent?.(
    new target.CustomEvent("edgesuite:product-menu-opened", {
      detail: { panel_id: PANEL_ID, trigger_id: TRIGGER_ID },
    }),
  );
}

export function installProductMenuMountEnhancements(edgeUI, target = globalThis) {
  if (!edgeUI || edgeUI.__productMenuMountEnhancementsInstalled) return edgeUI;
  const document = target.document;
  if (!document) return edgeUI;

  const originalRegister = edgeUI.registerProductMenu?.bind(edgeUI);
  const originalMount = edgeUI.mountProductMenu?.bind(edgeUI);
  const originalRefresh = edgeUI.refreshProductMenu?.bind(edgeUI);
  const originalOpen = edgeUI.openProductMenu?.bind(edgeUI);
  const originalClose = edgeUI.closeProductMenu?.bind(edgeUI);
  if (!originalRegister || !originalMount || !originalOpen || !originalClose) return edgeUI;

  let scheduled = false;
  let observer = null;
  let directToggle = null;

  const mountAtPreferredTarget = () => {
    const menuTarget = preferredTarget(document);
    if (!menuTarget) {
      removeNativeMenuArtifacts(document, originalClose);
      return false;
    }

    stabilizeSlot(menuTarget);
    const needsTemporaryNavbarClass = !menuTarget.classList.contains("navbar");
    if (needsTemporaryNavbarClass) menuTarget.classList.add("navbar");
    let result = false;
    try {
      result = originalMount();
    } finally {
      if (needsTemporaryNavbarClass) menuTarget.classList.remove("navbar");
    }

    const moved = moveHost(document, directToggle);
    bindDirectTrigger(document, directToggle);
    bindDelegatedTrigger(document, directToggle);
    return moved || result;
  };

  const scheduleMount = () => {
    if (scheduled) return;
    scheduled = true;
    const schedule = target.requestAnimationFrame || ((callback) => target.setTimeout?.(callback, 0));
    schedule?.(() => {
      scheduled = false;
      mountAtPreferredTarget();
    });
  };

  const openMenu = () => {
    if (!edgeShellPresent(document)) {
      removeNativeMenuArtifacts(document, originalClose);
      return false;
    }
    mountAtPreferredTarget();
    moveHost(document, directToggle);
    const opened = Boolean(originalOpen());
    moveHost(document, directToggle);
    if (opened) emitMenuOpened(target);
    scheduleMount();
    return opened;
  };

  const closeMenu = () => {
    originalClose();
    return false;
  };

  edgeUI.registerProductMenu = function registerProductMenu(config) {
    const registered = originalRegister(config);
    mountAtPreferredTarget();
    scheduleMount();
    return registered;
  };

  edgeUI.mountProductMenu = mountAtPreferredTarget;

  edgeUI.refreshProductMenu = function refreshProductMenu() {
    if (!edgeShellPresent(document)) {
      removeNativeMenuArtifacts(document, originalClose);
      return false;
    }
    const refreshed = originalRefresh ? originalRefresh() : mountAtPreferredTarget();
    moveHost(document, directToggle);
    scheduleMount();
    return refreshed;
  };

  edgeUI.openProductMenu = openMenu;
  edgeUI.closeProductMenu = closeMenu;
  edgeUI.toggleProductMenu = function toggleProductMenu() {
    if (!edgeShellPresent(document)) {
      removeNativeMenuArtifacts(document, originalClose);
      return false;
    }
    const panel = document.getElementById(PANEL_ID);
    return panel && !panel.hidden ? closeMenu() : openMenu();
  };
  directToggle = edgeUI.toggleProductMenu;
  bindDirectTrigger(document, directToggle);
  bindDelegatedTrigger(document, directToggle);

  ["desktop_screen", "sidebar_setup", "toolbar_setup", "page-change"].forEach((eventName) => {
    document.addEventListener(eventName, scheduleMount);
  });
  document.addEventListener("visibilitychange", scheduleMount);
  ["resize", "orientationchange", "hashchange", "popstate", "pageshow"].forEach((eventName) => {
    target.addEventListener?.(eventName, scheduleMount);
  });
  target.frappe?.router?.on?.("change", scheduleMount);

  if (target.MutationObserver && document.body) {
    observer = new target.MutationObserver(() => {
      if (!edgeShellPresent(document)) {
        removeNativeMenuArtifacts(document, originalClose);
        return;
      }
      const host = document.getElementById(HOST_ID);
      const panel = document.getElementById(PANEL_ID);
      const trigger = document.getElementById(TRIGGER_ID);
      const slot = document.getElementById(SLOT_ID);
      const targetNode = shellProductNavigationTarget(document);
      if (!host || !panel || !trigger || (targetNode && slot?.parentElement !== targetNode)) {
        scheduleMount();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"],
    });
  }

  edgeUI.__productMenuMountEnhancementsInstalled = true;
  edgeUI.__productMenuMountObserver = observer;
  scheduleMount();
  return edgeUI;
}
