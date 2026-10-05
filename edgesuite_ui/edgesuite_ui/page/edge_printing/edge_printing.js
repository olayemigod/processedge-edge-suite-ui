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

function appendContextBadge(actions, label) {
  if (!label) return;
  const badge = document.createElement("span");
  badge.className = "edge-status-badge edge-status-badge--neutral";
  badge.textContent = label;
  actions.appendChild(badge);
}

function buildEdgeSuitePageChrome(context) {
  const root = document.createElement("section");
  root.className = "edge-page-layout edge-printing-page-root";
  root.setAttribute("data-edge-suite-page", "true");

  const headerWrap = document.createElement("div");
  headerWrap.className = "edge-page-layout__header edge-page-layout-header";

  const header = document.createElement("header");
  header.className = "edge-page-header";

  const copy = document.createElement("div");
  copy.className = "edge-page-header__copy";

  const eyebrow = document.createElement("p");
  eyebrow.className = "edge-eyebrow";
  eyebrow.textContent = __("Printing");

  const title = document.createElement("h1");
  title.className = "edge-page-header__title edge-page-title";
  title.textContent = __("Devices & Printing");

  const subtitle = document.createElement("p");
  subtitle.className = "edge-page-header__subtitle edge-page-subtitle";
  subtitle.textContent = __(
    "Connect this device to an authorised receipt printer and test the active printer configuration.",
  );

  copy.append(eyebrow, title, subtitle);

  const actions = document.createElement("div");
  actions.className = "edge-page-header__actions edge-printing-page-actions";
  appendContextBadge(actions, context.company ? `Company: ${context.company}` : "");
  appendContextBadge(actions, context.branch ? `Branch: ${context.branch}` : "");

  if (canManageProfiles()) {
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = "edge-button edge-button--secondary";
    manage.textContent = __("Manage Print Profiles");
    manage.addEventListener("click", () => frappe.set_route("List", "Edge Print Profile"));
    actions.appendChild(manage);
  }

  header.append(copy, actions);
  headerWrap.appendChild(header);

  const content = document.createElement("main");
  content.className = "edge-page-layout__content edge-page-layout-body edge-printing-page-content";

  const host = document.createElement("div");
  host.className = "edge-printing-page-card";
  content.appendChild(host);

  root.append(headerWrap, content);
  return { root, host };
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
  const { root, host } = buildEdgeSuitePageChrome(context);
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
