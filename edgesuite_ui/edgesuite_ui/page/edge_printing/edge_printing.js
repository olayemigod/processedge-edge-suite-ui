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

function contextSummary(context) {
  return [
    context.productKey ? `Product: ${context.productKey}` : "",
    context.company ? `Company: ${context.company}` : "",
    context.branch ? `Branch: ${context.branch}` : "",
  ].filter(Boolean);
}

function canManageProfiles() {
  return (frappe.user_roles || []).includes("System Manager");
}

async function mountPrintingPage(wrapper, page) {
  if (!globalThis.EdgeSuiteUI?.getComponent?.("EdgePrinterSetupCard")) {
    await edgePrintingRequire(EDGE_SUITE_ASSET);
  }
  const edgeUI = globalThis.EdgeSuiteUI;
  if (!edgeUI?.getComponent?.("EdgePrinterSetupCard")) {
    throw new Error("EdgeSuite shared printing runtime is unavailable.");
  }

  try {
    await edgeUI.refreshAvailableProducts?.();
  } catch (_error) {
    // Global/user print profiles remain usable even if product availability refresh is unavailable.
  }

  const context = routeContext(edgeUI);
  const root = document.createElement("div");
  root.className = "edge-printing-page-root";
  root.setAttribute("data-edge-suite-page", "true");

  const intro = document.createElement("section");
  intro.className = "edge-printing-page-intro";
  const heading = document.createElement("div");
  heading.innerHTML = [
    "<h2>Devices & Printing</h2>",
    "<p>Connect this browser to an authorised local printer and test the resolved EdgeSuite print profile.</p>",
  ].join("");
  intro.appendChild(heading);

  const summary = contextSummary(context);
  if (summary.length) {
    const chips = document.createElement("div");
    chips.className = "edge-printing-page-context";
    summary.forEach((label) => {
      const chip = document.createElement("span");
      chip.textContent = label;
      chips.appendChild(chip);
    });
    intro.appendChild(chips);
  }

  const host = document.createElement("div");
  host.className = "edge-printing-page-card";
  root.append(intro, host);
  page.body.append(root);

  const component = edgeUI.getComponent("EdgePrinterSetupCard");
  const app = edgeUI.createEdgeApp(component, {
    title: "Receipt Printer",
    purpose: context.purpose,
    productKey: context.productKey,
    company: context.company,
    branch: context.branch,
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

  if (canManageProfiles()) {
    page.add_menu_item(__("Manage Print Profiles"), () => {
      frappe.set_route("List", "Edge Print Profile");
    });
  }

  const loading = document.createElement("div");
  loading.className = "edge-boot-loading p-6 text-center text-muted";
  loading.textContent = __("Loading printing devices...");
  page.body.append(loading);

  try {
    await mountPrintingPage(wrapper, page);
    loading.remove();
  } catch (error) {
    loading.remove();
    const node = document.createElement("div");
    node.className = "alert alert-danger p-6 text-center";
    node.textContent = error?.message || __("Devices & Printing failed to load.");
    page.body.append(node);
  }
};

frappe.pages[EDGE_PRINTING_PAGE].on_page_show = function onEdgePrintingPageShow(wrapper) {
  wrapper.setAttribute("data-edge-suite-page", "true");
  hideNativeSidebar(wrapper);
};
