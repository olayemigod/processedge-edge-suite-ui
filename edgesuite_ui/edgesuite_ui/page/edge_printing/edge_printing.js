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

function actionButton(label, onClick, { primary = false, danger = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary
    ? "edge-button edge-button--primary"
    : "edge-button edge-button--secondary";
  if (danger) button.classList.add("edge-button--danger");
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
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
    const manage = actionButton("Manage Print Profiles", () => frappe.set_route("edge-print-profiles"));
    actions.appendChild(manage);
  }

  header.append(copy, actions);
  headerWrap.appendChild(header);

  const content = document.createElement("main");
  content.className = "edge-page-layout__content edge-page-layout-body edge-printing-page-content";

  const host = document.createElement("div");
  host.className = "edge-printing-page-card";
  content.appendChild(host);

  const simulatorHost = document.createElement("div");
  simulatorHost.className = "edge-printing-simulator-host";
  content.appendChild(simulatorHost);

  root.append(headerWrap, content);
  return { root, host, simulatorHost };
}

function virtualJobSummary(job) {
  if (!job) return null;
  const commands = job.commands || {};
  return [
    `Printed: ${job.printedAt || "—"}`,
    `Bytes written: ${job.bytesWritten || 0}`,
    `Cut commands: ${commands.cuts || 0}`,
    `Drawer pulses: ${commands.drawerPulses || 0}`,
    `QR commands: ${commands.qrCommands || 0}`,
    `Barcode commands: ${commands.barcodes || 0}`,
    `Feed lines: ${commands.feedLines || 0}`,
  ];
}

function renderSimulatorPanel(edgeUI, host, rerenderPrinter) {
  host.replaceChildren();
  if (!canManageProfiles() || !edgeUI?.print?.simulation) return;

  const simulation = edgeUI.print.simulation;
  const enabled = simulation.isEnabled();
  const card = document.createElement("section");
  card.className = "edge-card edge-printing-simulator";

  const header = document.createElement("div");
  header.className = "edge-printer-setup__header";
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = __("Virtual Printer (QA)");
  const note = document.createElement("p");
  note.textContent = __(
    "Simulate the real ESC/POS print pipeline without physical hardware. The mode is in-memory only and never creates a printer profile or device binding.",
  );
  copy.append(title, note);
  const badge = document.createElement("span");
  badge.className = `edge-status-badge ${enabled ? "edge-status-badge--success" : "edge-status-badge--neutral"}`;
  badge.textContent = enabled ? __("Active") : __("Off");
  header.append(copy, badge);

  const actions = document.createElement("div");
  actions.className = "edge-printer-setup__actions";
  const toggle = actionButton(
    enabled ? "Return to Physical Printer" : "Enable Virtual Printer",
    async () => {
      toggle.disabled = true;
      try {
        if (enabled) await simulation.disable();
        else await simulation.enable();
        await rerenderPrinter();
        renderSimulatorPanel(edgeUI, host, rerenderPrinter);
        frappe.show_alert({
          message: enabled ? "Physical printer mode restored" : "Virtual printer enabled",
          indicator: "green",
        });
      } catch (error) {
        frappe.msgprint({
          title: "Unable to change printer mode",
          message: error?.message || String(error),
          indicator: "red",
        });
      } finally {
        toggle.disabled = false;
      }
    },
    { primary: !enabled },
  );
  actions.appendChild(toggle);

  if (enabled) {
    const failureMode = simulation.getFailureMode();
    actions.append(
      actionButton("View Last Virtual Print", () => renderSimulatorPanel(edgeUI, host, rerenderPrinter)),
      actionButton(
        failureMode === "write" ? "Clear Simulated Failure" : "Fail Next Print",
        () => {
          simulation.setFailureMode(failureMode === "write" ? null : "write");
          renderSimulatorPanel(edgeUI, host, rerenderPrinter);
        },
        { danger: failureMode !== "write" },
      ),
      actionButton("Clear History", () => {
        simulation.clearHistory();
        renderSimulatorPanel(edgeUI, host, rerenderPrinter);
      }),
    );
  }

  card.append(header, actions);

  if (enabled) {
    const job = simulation.getLastJob();
    const state = document.createElement("section");
    state.className = job ? "edge-state" : "edge-state edge-state--empty";
    if (!job) {
      const emptyTitle = document.createElement("h4");
      emptyTitle.className = "edge-state__title";
      emptyTitle.textContent = __("No simulated print yet");
      const description = document.createElement("p");
      description.className = "edge-state__description";
      description.textContent = __(
        "Use Test Print above or print a submitted RetailEdge receipt. Then return here and choose View Last Virtual Print.",
      );
      state.append(emptyTitle, description);
    } else {
      const resultTitle = document.createElement("h4");
      resultTitle.className = "edge-state__title";
      resultTitle.textContent = __("Last Virtual Print");
      const summary = document.createElement("pre");
      summary.textContent = virtualJobSummary(job).join("\n");
      const receiptTitle = document.createElement("h4");
      receiptTitle.textContent = __("Thermal Text Preview");
      const receipt = document.createElement("pre");
      receipt.className = "edge-printing-simulator__receipt";
      receipt.textContent = job.previewText || __("No printable text was detected in this ESC/POS payload.");
      const hexTitle = document.createElement("h4");
      hexTitle.textContent = __("ESC/POS Byte Sample");
      const hex = document.createElement("pre");
      hex.textContent = job.hexSample || "—";
      state.append(resultTitle, summary, receiptTitle, receipt, hexTitle, hex);
    }
    card.appendChild(state);
  }

  host.appendChild(card);
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
  const { root, host, simulatorHost } = buildEdgeSuitePageChrome(context);
  page.body.append(root);

  const component = edgeUI.getComponent("EdgePrinterSetupCard");
  async function renderPrinter() {
    wrapper._edgePrintingApp?.unmount?.();
    host.replaceChildren();
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

  await renderPrinter();
  renderSimulatorPanel(edgeUI, simulatorHost, renderPrinter);
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
