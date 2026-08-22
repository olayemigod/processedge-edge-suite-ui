const HOST_ID = "edge-product-menu-host";
const PANEL_ID = "edge-product-menu-dropdown";
const TRIGGER_ID = "edge-product-menu-trigger";
const SLOT_ID = "edge-product-menu-slot";
const DIRECT_HANDLER_KEY = "__edgeSuiteProductMenuDirectHandler";
const DELEGATED_HANDLER_KEY = "__edgeSuiteProductMenuDelegatedHandler";

const NATIVE_NAVBAR_SELECTORS = [
  ".navbar .navbar-nav.ms-auto",
  ".navbar .navbar-nav.ml-auto",
  ".navbar .navbar-right",
  ".navbar .navbar-nav:last-of-type",
  "header.navbar .navbar-nav",
  ".desktop-navbar .navbar-nav",
  "header.navbar",
  ".desktop-navbar",
  ".navbar",
];

function visibleElement(element) {
  if (!element?.isConnected) return false;
  const view = element.ownerDocument?.defaultView;
  const style = view?.getComputedStyle?.(element);
  if (style?.visibility === "hidden" || style?.display === "none") return false;
  const box = element.getBoundingClientRect?.();
  return !box || (box.width > 0 && box.height > 0);
}

function edgeShellPresent(document) {
  return Boolean(document.querySelector(".edge-app-shell[data-edge-product]"));
}

function stabilizeSlot(slot, { fallback = false } = {}) {
  if (!slot) return null;
  slot.hidden = false;
  slot.classList.add("edge-product-menu-slot", "navbar");
  slot.classList.toggle("edge-product-menu-slot--fallback", fallback);
  slot.style.display = "inline-flex";
  slot.style.alignItems = "center";
  slot.style.flex = "0 0 auto";
  slot.style.minWidth = "2.5rem";
  slot.style.minHeight = "2.5rem";
  slot.style.padding = "0";
  slot.style.pointerEvents = "auto";

  if (fallback) {
    slot.style.position = "fixed";
    slot.style.right = "0.75rem";
    slot.style.top = "0.65rem";
    slot.style.zIndex = "1061";
    slot.style.order = "";
    slot.style.margin = "0";
  } else {
    slot.style.position = "relative";
    slot.style.right = "";
    slot.style.top = "";
    slot.style.zIndex = "4";
    slot.style.order = "-20";
    slot.style.margin = "0 0.25rem 0 0";
  }
  return slot;
}

function shellActions(document) {
  const nodes = Array.from(
    document.querySelectorAll(
      ".edge-app-shell[data-edge-product] .edge-app-shell__topbar .edge-topbar-actions, " +
        ".edge-app-shell[data-edge-product] .edge-topbar-actions",
    ),
  ).reverse();
  return nodes.find(visibleElement) || nodes.find((node) => node?.isConnected) || null;
}

function ensureShellSlot(document) {
  const actions = shellActions(document);
  if (!actions) return null;
  let slot = document.getElementById(SLOT_ID);
  if (!slot) {
    slot = document.createElement("span");
    slot.id = SLOT_ID;
  }
  stabilizeSlot(slot);
  if (slot.parentElement !== actions || actions.firstElementChild !== slot) {
    actions.insertBefore(slot, actions.firstChild || null);
  }
  return slot;
}

function visibleShellTarget(document) {
  return ensureShellSlot(document);
}

function visibleNativeTarget(document) {
  for (const selector of NATIVE_NAVBAR_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll(selector)).reverse();
    const target = nodes.find(
      (node) =>
        !node.closest?.(".edge-app-shell") &&
        node.id !== SLOT_ID &&
        visibleElement(node),
    );
    if (target) return target;
  }
  return null;
}

function ensureFallbackSlot(document) {
  if (edgeShellPresent(document)) return null;
  let slot = document.getElementById(SLOT_ID);
  if (!slot) {
    slot = document.createElement("span");
    slot.id = SLOT_ID;
    document.body?.appendChild(slot);
  }
  return stabilizeSlot(slot, { fallback: true });
}

function preferredTarget(document) {
  return visibleShellTarget(document) || visibleNativeTarget(document) || ensureFallbackSlot(document);
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
    if (!menuTarget) return false;
    stabilizeSlot(menuTarget.id === SLOT_ID ? menuTarget : null, {
      fallback: menuTarget.classList.contains("edge-product-menu-slot--fallback"),
    });
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
    const refreshed = originalRefresh ? originalRefresh() : mountAtPreferredTarget();
    moveHost(document, directToggle);
    scheduleMount();
    return refreshed;
  };

  edgeUI.openProductMenu = openMenu;
  edgeUI.closeProductMenu = closeMenu;
  edgeUI.toggleProductMenu = function toggleProductMenu() {
    const panel = document.getElementById(PANEL_ID);
    return panel && !panel.hidden ? closeMenu() : openMenu();
  };
  directToggle = edgeUI.toggleProductMenu;
  bindDirectTrigger(document, directToggle);
  bindDelegatedTrigger(document, directToggle);

  ["desktop_screen", "sidebar_setup", "toolbar_setup", "page-change"].forEach((eventName) => {
    document.addEventListener(eventName, scheduleMount);
  });
  target.addEventListener?.("resize", scheduleMount);
  target.addEventListener?.("orientationchange", scheduleMount);
  target.frappe?.router?.on?.("change", scheduleMount);

  if (target.MutationObserver && document.body) {
    observer = new target.MutationObserver(() => {
      const host = document.getElementById(HOST_ID);
      const panel = document.getElementById(PANEL_ID);
      const trigger = document.getElementById(TRIGGER_ID);
      const slot = document.getElementById(SLOT_ID);
      const actions = shellActions(document);
      if (
        !host ||
        !panel ||
        !trigger ||
        (actions && (slot?.parentElement !== actions || actions.firstElementChild !== slot))
      ) {
        scheduleMount();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  edgeUI.__productMenuMountEnhancementsInstalled = true;
  edgeUI.__productMenuMountObserver = observer;
  scheduleMount();
  return edgeUI;
}
