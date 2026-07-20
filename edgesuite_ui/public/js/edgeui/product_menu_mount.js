const HOST_ID = "edge-product-menu-host";
const PANEL_ID = "edge-product-menu-dropdown";

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

function visibleShellTarget(document) {
  const selectors = [
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

function visibleNativeTarget(document) {
  for (const selector of NATIVE_NAVBAR_SELECTORS) {
    const nodes = Array.from(document.querySelectorAll(selector)).reverse();
    const target = nodes.find(
      (node) => !node.closest?.(".edge-app-shell") && visibleElement(node),
    );
    if (target) return target;
  }
  return null;
}

function preferredTarget(document) {
  return visibleShellTarget(document) || visibleNativeTarget(document);
}

function moveHost(document) {
  const host = document.getElementById(HOST_ID);
  const target = preferredTarget(document);
  if (!host || !target || host.parentElement === target) return Boolean(host);
  target.appendChild(host);
  return true;
}

export function installProductMenuMountEnhancements(edgeUI, target = globalThis) {
  if (!edgeUI || edgeUI.__productMenuMountEnhancementsInstalled) return edgeUI;
  const document = target.document;
  if (!document) return edgeUI;

  const originalRegister = edgeUI.registerProductMenu?.bind(edgeUI);
  const originalMount = edgeUI.mountProductMenu?.bind(edgeUI);
  const originalRefresh = edgeUI.refreshProductMenu?.bind(edgeUI);
  const originalOpen = edgeUI.openProductMenu?.bind(edgeUI);
  if (!originalRegister || !originalMount) return edgeUI;

  let scheduled = false;
  let observer = null;

  const mountAtPreferredTarget = () => {
    const shellTarget = visibleShellTarget(document);
    const needsTemporaryNavbarClass = Boolean(
      shellTarget && !shellTarget.classList.contains("navbar"),
    );

    if (needsTemporaryNavbarClass) shellTarget.classList.add("navbar");
    let result = false;
    try {
      result = originalMount();
    } finally {
      if (needsTemporaryNavbarClass) shellTarget.classList.remove("navbar");
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

  edgeUI.registerProductMenu = function registerProductMenu(config) {
    const registered = originalRegister(config);
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

  edgeUI.openProductMenu = function openProductMenu() {
    mountAtPreferredTarget();
    return originalOpen ? originalOpen() : false;
  };

  ["desktop_screen", "sidebar_setup", "toolbar_setup", "page-change"].forEach((eventName) => {
    document.addEventListener(eventName, scheduleMount);
  });
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
