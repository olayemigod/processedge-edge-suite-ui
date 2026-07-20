const PRODUCT_CLASS_PREFIX = "edge-suite-product-";

let focusObserver = null;
let focusRefreshScheduled = false;

function normalizedProduct(value) {
  return (
    String(value || "edgesuite")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "edgesuite"
  );
}

function shellRegistry() {
  return globalThis.__edgeSuiteShellRegistry instanceof Map
    ? globalThis.__edgeSuiteShellRegistry
    : new Map();
}

function elementIsVisible(element) {
  if (!element?.isConnected || typeof document === "undefined") return false;

  let current = element;
  while (current && current !== document.body) {
    if (current.hidden || current.getAttribute?.("aria-hidden") === "true") return false;
    const style = globalThis.getComputedStyle?.(current);
    if (
      style &&
      (style.display === "none" ||
        style.visibility === "hidden" ||
        style.contentVisibility === "hidden")
    ) {
      return false;
    }
    current = current.parentElement;
  }

  return Boolean(
    element.getClientRects?.().length || element.offsetWidth || element.offsetHeight,
  );
}

function visibleProductShells() {
  if (typeof document === "undefined") return [];
  return [...document.querySelectorAll(".edge-app-shell[data-edge-product]")].filter(
    elementIsVisible,
  );
}

function shouldHideNativeSidebar(shell, registry) {
  const product = normalizedProduct(shell.getAttribute("data-edge-product"));
  const registered = registry.get(product);
  if (registered && Object.prototype.hasOwnProperty.call(registered, "hideNativeSidebar")) {
    return Boolean(registered.hideNativeSidebar);
  }

  // Preserve the existing EduEdge default during the brief interval before the
  // shell registry is populated. Other products must opt in explicitly.
  return product === "eduedge";
}

function clearProductClasses(body) {
  for (const className of [...body.classList]) {
    if (className.startsWith(PRODUCT_CLASS_PREFIX)) body.classList.remove(className);
  }
}

export function syncSidebarFocus() {
  focusRefreshScheduled = false;
  if (typeof document === "undefined" || !document.body) return;

  const body = document.body;
  const shells = visibleProductShells();
  const registry = shellRegistry();
  const focused = shells.length > 0;
  const hideNativeSidebar = focused && shells.some((shell) => shouldHideNativeSidebar(shell, registry));

  body.classList.toggle("edge-suite-shell-focused", focused);
  body.classList.toggle("edge-suite-shell-active", focused);
  body.classList.toggle("edge-suite-native-sidebar-hidden", hideNativeSidebar);

  clearProductClasses(body);
  for (const shell of shells) {
    body.classList.add(
      `${PRODUCT_CLASS_PREFIX}${normalizedProduct(shell.getAttribute("data-edge-product"))}`,
    );
  }
}

export function scheduleSidebarFocusSync() {
  if (focusRefreshScheduled) return;
  focusRefreshScheduled = true;
  const schedule = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
  schedule(syncSidebarFocus);
}

export function installSidebarFocusLifecycle(edgeUI) {
  if (!edgeUI || edgeUI.__sidebarFocusLifecycleInstalled) return edgeUI;
  edgeUI.__sidebarFocusLifecycleInstalled = true;

  if (typeof document === "undefined") return edgeUI;

  const start = () => {
    if (!document.body) {
      globalThis.setTimeout?.(start, 0);
      return;
    }

    if (!focusObserver && typeof MutationObserver !== "undefined") {
      focusObserver = new MutationObserver(scheduleSidebarFocusSync);
      focusObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "aria-hidden"],
      });
    }

    document.addEventListener("page-change", scheduleSidebarFocusSync);
    document.addEventListener("visibilitychange", scheduleSidebarFocusSync);
    globalThis.addEventListener?.("hashchange", scheduleSidebarFocusSync);
    globalThis.addEventListener?.("popstate", scheduleSidebarFocusSync);
    globalThis.addEventListener?.("pageshow", scheduleSidebarFocusSync);
    globalThis.frappe?.router?.on?.("change", scheduleSidebarFocusSync);
    scheduleSidebarFocusSync();
  };

  start();
  return edgeUI;
}
