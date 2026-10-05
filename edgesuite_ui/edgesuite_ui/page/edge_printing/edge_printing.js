const EDGE_PRINTING_PAGE = "edge-printing";
const EDGE_SUITE_ASSET = "edgesuite_ui.bundle.js";

function edgePrintingRequire(assetName) {
  return new Promise((resolve, reject) => {
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      resolve();
    };
    const fail = (error) => {
      if (completed) return;
      completed = true;
      reject(error instanceof Error ? error : new Error(String(error || assetName)));
    };
    try {
      const pending = frappe.require(assetName, finish);
      if (pending && typeof pending.then === "function") pending.then(finish).catch(fail);
    } catch (error) {
      fail(error);
    }
  });
}

function hideNativeSidebar(wrapper) {
  const pageContainer = wrapper.closest?.(".page-container") || wrapper;
  const sideSection = pageContainer.querySelector?.(".layout-side-section");
  const mainWrapper = pageContainer.querySelector?.(".layout-main-section-wrapper");
  if (sideSection) {
    sideSection.hidden = true;
    sideSection.setAttribute("aria-hidden", "true");
  }
  if (mainWrapper) {
    mainWrapper.style.width = "100%";
    mainWrapper.style.maxWidth = "100%";
  }
}

function routeContext(edgeUI) {
  const params = new URLSearchParams(globalThis.location?.search || "");
  const activeProduct = edgeUI?.getActiveProduct?.();
  return {
    purpose: params.get("purpose") || "Receipt",
    productKey: params.get("product_key") || params.get("product") || activeProduct?.key || "",
    company: params.get("company") || "",
    branch: params.get("branch") || "",
  };
}

function canManageProfiles() {
  return (frappe.user_roles || []).includes("System Manager");
}

async function mountPrintingPage(wrapper, page) {
  if (!globalThis.EdgeSuiteUI?.getComponent?.("EdgePrintingSetupPage")) {
    await edgePrintingRequire(EDGE_SUITE_ASSET);
  }
  const edgeUI = globalThis.EdgeSuiteUI;
  if (!edgeUI?.getComponent?.("EdgePrintingSetupPage")) {
    throw new Error("EdgeSuite shared printing page is unavailable.");
  }

  try {
    await edgeUI.refreshAvailableProducts?.();
  } catch (_error) {
    // Global/user print profiles remain usable even if product availability refresh is unavailable.
  }

  const context = routeContext(edgeUI);
  const host = document.createElement("div");
  host.className = "edge-printing-page-root";
  host.setAttribute("data-edge-suite-page", "true");
  page.body.append(host);

  const component = edgeUI.getComponent("EdgePrintingSetupPage");
  const app = edgeUI.createEdgeApp(component, {
    purpose: context.purpose,
    productKey: context.productKey,
    company: context.company,
    branch: context.branch,
    canManageProfiles: canManageProfiles(),
    onManageProfiles: () => frappe.set_route("List", "Edge Print Profile"),
  });
  app.mount(host);
  wrapper._edgePrintingApp = app;
}

frappe.pages[EDGE_PRINTING_PAGE].on_page_load = async function onEdgePrintingPageLoad(wrapper) {
  wrapper.setAttribute("data-edge-suite-page", "true");
  hideNativeSidebar(wrapper);

  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __("Devices & Printing"),
    single_column: true,
  });
  wrapper.page = page;
  page.body?.setAttribute?.("data-edge-suite-page", "true");

  const loading = document.createElement("section");
  loading.className = "edge-state edge-state--loading edge-loading-state";
  loading.setAttribute("role", "status");
  loading.innerHTML = [
    '<span class="edge-spinner edge-loading-spinner" aria-hidden="true"></span>',
    '<p class="edge-state__description">Loading printing devices...</p>',
  ].join("");
  page.body.append(loading);

  try {
    await mountPrintingPage(wrapper, page);
    loading.remove();
  } catch (error) {
    loading.remove();
    const node = document.createElement("section");
    node.className = "edge-state edge-state--error edge-error-state";
    node.setAttribute("role", "alert");
    const title = document.createElement("h2");
    title.className = "edge-state__title";
    title.textContent = __("Devices & Printing failed to load");
    const message = document.createElement("p");
    message.className = "edge-state__description";
    message.textContent = error?.message || __("Please refresh and try again.");
    node.append(title, message);
    page.body.append(node);
  }
};

frappe.pages[EDGE_PRINTING_PAGE].on_page_show = function onEdgePrintingPageShow(wrapper) {
  wrapper.setAttribute("data-edge-suite-page", "true");
  hideNativeSidebar(wrapper);
};
