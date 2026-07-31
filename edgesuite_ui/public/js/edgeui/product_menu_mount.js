const HOST_ID = "edge-product-menu-host";
const PANEL_ID = "edge-product-menu-dropdown";
const TRIGGER_ID = "edge-product-menu-trigger";
const SLOT_ID = "edge-product-menu-slot";

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
    slot.className = "edge-product-menu-slot navbar";
  }
  if (slot.parentElement !== actions) actions.insertBefore(slot, actions.firstChild || null);
  return slot;
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
  let slot = document.getElementById(SLOT_ID);
  if (!slot) {
    slot = document.createElement("span");
    slot.id = SLOT_ID;
    slot.className = "edge-product-menu-slot edge-product-menu-slot--fallback navbar";
    document.body?.appendChild(slot);
  }
  return slot;
}

function preferredTarget(document) {
  return ensureShellSlot(document) || visibleNativeTarget(document) || ensureFallbackSlot(document);
}

function moveHost(document) {
  const host = document.getElementById(HOST_ID);
  const target = preferredTarget(document);
  if (!host || !target) return false;
  if (host.parentElement !== target) target.appendChild(host);
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

  const mountAtPreferredTarget = () => {
    const menuTarget = preferredTarget(document);
    const needsTemporaryNavbarClass = Boolean(
      menuTarget && !menuTarget.classList.contains("navbar"),
    );

    if (needsTemporaryNavbarClass) menuTarget.classList.add("navbar");
    let result = false;
    try {
      result = originalMount();
    } finally {
      if (needsTemporaryNavbarClass) menuTarget.classList.remove("navbar");
    }

    return moveHost(document) || result;
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
    moveHost(document);
    const opened = Boolean(originalOpen());
    moveHost(document);
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
    moveHost(document);
    scheduleMount();
    return refreshed;
  };

  edgeUI.openProductMenu = openMenu;
  edgeUI.closeProductMenu = closeMenu;
  edgeUI.toggleProductMenu = function toggleProductMenu() {
    const panel = document.getElementById(PANEL_ID);
    return panel && !panel.hidden ? closeMenu() : openMenu();
  };

  document.addEventListener(
    "click",
    (event) => {
      const trigger = event.target?.closest?.(`#${TRIGGER_ID}`);
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      edgeUI.toggleProductMenu();
    },
    true,
  );

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
      const targetNode = preferredTarget(document);
      if (!host || !panel || (targetNode && host.parentElement !== targetNode)) scheduleMount();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  edgeUI.__productMenuMountEnhancementsInstalled = true;
  edgeUI.__productMenuMountObserver = observer;
  scheduleMount();
  return edgeUI;
}
