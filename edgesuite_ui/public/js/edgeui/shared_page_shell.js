function resolveElement(value) {
  if (!value) return null;
  if (value.nodeType === 1) return value;
  if (value.jquery && value[0]?.nodeType === 1) return value[0];
  if (value[0]?.nodeType === 1) return value[0];
  return null;
}

function canonicalRoute(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text, globalThis.location?.origin || "http://localhost");
    let path = url.pathname || "";
    if (path.startsWith("/desk/")) path = `/app/${path.slice(6)}`;
    return path.replace(/\/+$/, "") || "/";
  } catch (_error) {
    return text.split("?")[0].replace(/^\/desk\//, "/app/").replace(/\/+$/, "");
  }
}

function menuRows(menuItems = []) {
  const rows = [];
  for (const item of Array.isArray(menuItems) ? menuItems : []) {
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item.items)) rows.push(...menuRows(item.items));
    else rows.push(item);
  }
  return rows;
}

function activeMenuRoute(menuItems, activeRoute) {
  const target = canonicalRoute(activeRoute);
  if (!target) return activeRoute || "";
  const match = menuRows(menuItems).find((item) => canonicalRoute(item.route) === target);
  return match?.route || activeRoute || "";
}

function productDescriptor(edgeUI, productKey) {
  const key = String(productKey || "").trim().toLowerCase();
  return (edgeUI?.getAvailableProducts?.() || []).find(
    (product) => String(product?.key || "").trim().toLowerCase() === key,
  ) || null;
}

function defaultNavigate(route) {
  const value = String(route || "").trim();
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) {
    globalThis.location?.assign?.(value);
    return true;
  }

  let url;
  try {
    url = new URL(value, globalThis.location?.origin || "http://localhost");
  } catch (_error) {
    url = null;
  }
  if (url?.search || url?.hash) {
    globalThis.location?.assign?.(`${url.pathname}${url.search}${url.hash}`);
    return true;
  }

  const path = url?.pathname || value;
  if (path.startsWith("/app/") || path.startsWith("/desk/")) {
    const normalized = path.replace(/^\/(?:app|desk)\//, "");
    const parts = normalized
      .split("/")
      .filter(Boolean)
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch (_error) {
          return part;
        }
      });
    if (parts.length && typeof globalThis.frappe?.set_route === "function") {
      globalThis.frappe.set_route(...parts);
      return true;
    }
  }

  if (typeof globalThis.frappe?.set_route === "function") {
    globalThis.frappe.set_route(value);
    return true;
  }
  globalThis.location?.assign?.(value);
  return true;
}

async function waitForShellAdapter(edgeUI, productKey, timeoutMs = 1000) {
  const key = String(productKey || "").trim().toLowerCase();
  if (!key || typeof edgeUI?.getAdapter !== "function") return null;
  const adapterName = `shell:${key}`;
  const immediate = edgeUI.getAdapter(adapterName);
  if (immediate) return immediate;

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 25));
    const adapter = edgeUI.getAdapter(adapterName);
    if (adapter) return adapter;
  }
  return null;
}

export function suppressNativeDeskPageChrome(wrapper) {
  const root = resolveElement(wrapper);
  if (!root) return;
  root.setAttribute("data-edge-suite-page", "true");
  root.classList.add("edge-shared-shell-page");

  const pageContainer = root.closest?.(".page-container") || root;
  const pageHead = pageContainer.querySelector?.(".page-head");
  const sideSection = pageContainer.querySelector?.(".layout-side-section");
  const mainWrapper = pageContainer.querySelector?.(".layout-main-section-wrapper");
  if (pageHead) {
    pageHead.hidden = true;
    pageHead.setAttribute("aria-hidden", "true");
  }
  if (sideSection) {
    sideSection.hidden = true;
    sideSection.setAttribute("aria-hidden", "true");
  }
  if (mainWrapper) {
    mainWrapper.style.width = "100%";
    mainWrapper.style.maxWidth = "100%";
  }
}

export async function mountSharedPageShell(
  edgeUI,
  {
    target,
    content,
    productKey = "",
    activeRoute = "",
    fallbackMenuItems = [],
    title = "",
    tenantName = "",
    branchName = "",
    userName = "",
  } = {},
) {
  const targetElement = resolveElement(target);
  const contentElement = resolveElement(content);
  if (!targetElement || !contentElement) {
    throw new TypeError("Shared EdgeSuite page shell requires target and content elements.");
  }
  const Shell = edgeUI?.getComponent?.("EdgeAppShell");
  const Vue = edgeUI?.Vue;
  if (!Shell || !Vue?.defineComponent || !Vue?.h || typeof edgeUI?.createEdgeApp !== "function") {
    throw new Error("EdgeSuite application shell is unavailable.");
  }

  let resolvedProductKey = String(productKey || "").trim();
  if (!resolvedProductKey) resolvedProductKey = String(edgeUI.getActiveProduct?.()?.key || "").trim();
  const adapter = await waitForShellAdapter(edgeUI, resolvedProductKey);
  let productContext = {};
  if (typeof adapter?.getContext === "function") {
    try {
      productContext = (await adapter.getContext()) || {};
    } catch (error) {
      console.warn("[EdgeSuite shared page shell] product shell context unavailable", error);
    }
  }

  const descriptor = productDescriptor(edgeUI, resolvedProductKey);
  const menuItems = Array.isArray(productContext.menuItems) && productContext.menuItems.length
    ? productContext.menuItems
    : fallbackMenuItems;
  const effectiveActiveRoute = activeMenuRoute(menuItems, activeRoute);
  const shellTitle = productContext.title || title || descriptor?.label || descriptor?.product || "EdgeSuite";

  const navigate = (route) => {
    try {
      if (typeof adapter?.open === "function" && adapter.open(route) === true) return;
    } catch (error) {
      console.warn("[EdgeSuite shared page shell] product navigation failed", error);
    }
    defaultNavigate(route);
  };

  const Root = Vue.defineComponent({
    name: "EdgeSharedPageShellHost",
    setup() {
      return () =>
        Vue.h(
          Shell,
          {
            product: resolvedProductKey,
            menuItems,
            activeRoute: effectiveActiveRoute,
            title: shellTitle,
            tenantName: productContext.tenantName || tenantName || "",
            branchName: productContext.branchName || branchName || "",
            userName: productContext.userName || userName || "",
            onNavigate: navigate,
          },
          {
            default: () => Vue.h("div", { class: "edge-shared-page-content-host" }),
          },
        );
    },
  });

  targetElement.replaceChildren();
  const app = edgeUI.createEdgeApp(Root);
  app.mount(targetElement);
  const contentHost = targetElement.querySelector(".edge-shared-page-content-host");
  if (!contentHost) {
    app.unmount?.();
    throw new Error("EdgeSuite shared page shell did not create its content host.");
  }
  contentHost.appendChild(contentElement);

  return Object.freeze({
    app,
    adapter,
    context: productContext,
    productKey: resolvedProductKey,
    activeRoute: effectiveActiveRoute,
    contentHost,
  });
}
