const EDGE_PRINT_PROFILES_PAGE = "edge-print-profiles";
const EDGE_SUITE_ASSET = "edgesuite_ui.bundle.js";
const PRINTING_API = "edgesuite_ui.api.printing.";

function api(method, args = {}, type = "GET") {
  return frappe.call({ method: `${PRINTING_API}${method}`, args, type }).then((response) => response?.message);
}

function edgePrintProfilesRequire(assetName) {
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

function suppressNativePageChrome(wrapper) {
  const edgeUI = globalThis.EdgeSuiteUI;
  if (typeof edgeUI?.suppressNativeDeskPageChrome === "function") {
    edgeUI.suppressNativeDeskPageChrome(wrapper);
    return;
  }
  const pageContainer = wrapper.closest?.(".page-container") || wrapper;
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

function pageUrl(page, context = {}) {
  const params = new URLSearchParams();
  if (context.purpose) params.set("purpose", context.purpose);
  if (context.productKey) params.set("product_key", context.productKey);
  if (context.company) params.set("company", context.company);
  if (context.branch) params.set("branch", context.branch);
  const query = params.toString();
  return `/app/${page}${query ? `?${query}` : ""}`;
}

function printingFallbackMenu(context = {}) {
  return [
    {
      key: "printing",
      label: "Printing",
      icon: "settings",
      defaultCollapsed: false,
      items: [
        {
          label: "Devices & Printing",
          route: pageUrl("edge-printing", context),
          icon: "settings",
          link_type: "Page",
          link_to: "edge-printing",
        },
        {
          label: "Print Profiles",
          route: pageUrl("edge-print-profiles", context),
          icon: "list",
          link_type: "Page",
          link_to: "edge-print-profiles",
        },
      ],
    },
  ];
}

function pageBodyElement(page) {
  return page?.body?.[0] || page?.body || page?.main?.[0] || page?.main || null;
}

function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function actionButton(label, onClick, { primary = false, danger = false } = {}) {
  const button = node(
    "button",
    `edge-button ${primary ? "edge-button--primary" : "edge-button--secondary"}${danger ? " edge-button--danger" : ""}`,
    label,
  );
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function fieldShell(label, helper = "", { required = false } = {}) {
  const shell = node("label", "edge-input edge-print-profile-field");
  const labelNode = node("span", "edge-input__label", label);
  if (required) {
    const requiredNode = node("span", "edge-input__required", " *");
    labelNode.appendChild(requiredNode);
  }
  shell.appendChild(labelNode);
  if (helper) shell.dataset.helper = helper;
  return shell;
}

function appendHelper(shell, text) {
  if (!text) return;
  shell.appendChild(node("p", "edge-input__helper", text));
}

function textField(label, value, onInput, options = {}) {
  const shell = fieldShell(label, options.helper || "", options);
  const input = node("input", "edge-input__control");
  input.type = options.type || "text";
  input.value = value ?? "";
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.readOnly) {
    input.readOnly = true;
    shell.classList.add("is-readonly");
  }
  if (options.min !== undefined) input.min = String(options.min);
  if (options.max !== undefined) input.max = String(options.max);
  input.addEventListener("input", () => onInput(input.value));
  shell.appendChild(input);
  appendHelper(shell, options.helper || "");
  return { shell, input };
}

function textareaField(label, value, onInput, helper = "") {
  const shell = fieldShell(label, helper);
  shell.classList.add("edge-textarea");
  const input = node("textarea", "edge-textarea__control");
  input.value = value ?? "";
  input.rows = 4;
  input.addEventListener("input", () => onInput(input.value));
  shell.appendChild(input);
  appendHelper(shell, helper);
  return { shell, input };
}

function selectField(label, value, choices, onChange, options = {}) {
  const shell = fieldShell(label, options.helper || "", options);
  const select = node("select", "edge-input__control");
  choices.forEach((choice) => {
    const option = document.createElement("option");
    option.value = String(choice.value ?? "");
    option.textContent = choice.label;
    if (String(choice.value ?? "") === String(value ?? "")) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener("change", () => onChange(select.value));
  shell.appendChild(select);
  appendHelper(shell, options.helper || "");
  return { shell, select };
}

function checkboxField(label, checked, onChange, description = "") {
  const shell = node("label", "edge-checkbox edge-print-profile-checkbox");
  const surface = node("span", "edge-checkbox__surface");
  const input = node("input", "edge-checkbox__control");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  input.addEventListener("change", () => onChange(input.checked));
  const copy = node("span", "edge-checkbox__copy");
  copy.appendChild(node("span", "edge-checkbox__label", label));
  if (description) copy.appendChild(node("span", "edge-checkbox__description", description));
  surface.append(input, copy);
  shell.appendChild(surface);
  return { shell, input };
}

function section(title, description = "") {
  const wrap = node("section", "edge-print-profile-section edge-card");
  const header = node("div", "edge-print-profile-section__header");
  header.appendChild(node("h2", "edge-print-profile-section__title", title));
  if (description) header.appendChild(node("p", "edge-print-profile-section__description", description));
  const body = node("div", "edge-print-profile-section__body");
  wrap.append(header, body);
  return { wrap, body };
}

function productLabel(context, key) {
  if (!key) return "Shared";
  return context.products?.find((product) => product.key === key)?.label || key;
}

function scopeLabel(profile) {
  const scopeType = profile.scope_type || "Global";
  return scopeType === "Global" ? "Global" : `${scopeType}: ${profile.scope_value || "—"}`;
}

function makePageChrome() {
  const root = node("section", "edge-page-layout edge-print-profiles-page-root");
  root.setAttribute("data-edge-suite-page", "true");

  const headerWrap = node("div", "edge-page-layout__header edge-page-layout-header");
  const header = node("header", "edge-page-header");
  const copy = node("div", "edge-page-header__copy");
  copy.append(
    node("p", "edge-eyebrow", __("Printing")),
    node("h1", "edge-page-header__title edge-page-title", __("Print Profiles")),
    node(
      "p",
      "edge-page-header__subtitle edge-page-subtitle",
      __("Define which receipt printer policy applies by product, company, branch or user."),
    ),
  );
  const actions = node("div", "edge-page-header__actions edge-print-profiles-page-actions");
  header.append(copy, actions);
  headerWrap.appendChild(header);
  const content = node("main", "edge-page-layout__content edge-page-layout-body edge-print-profiles-page-content");
  root.append(headerWrap, content);
  return { root, actions, content };
}

function editorCapabilitySummary() {
  const box = node("div", "edge-print-profile-capability");
  box.append(
    node("strong", "edge-print-profile-capability__title", "Receipt printer"),
    node("span", "edge-print-profile-capability__value", "Serial / Bluetooth · ESC/POS"),
    node(
      "p",
      "edge-print-profile-capability__note",
      "These are the supported V1 capabilities, so they are fixed rather than configurable fields.",
    ),
  );
  return box;
}

frappe.pages[EDGE_PRINT_PROFILES_PAGE].on_page_load = async function onPrintProfilesLoad(wrapper) {
  wrapper.setAttribute("data-edge-suite-page", "true");
  suppressNativePageChrome(wrapper);

  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __("Print Profiles"),
    single_column: true,
  });
  wrapper.page = page;
  const body = pageBodyElement(page);
  body?.setAttribute?.("data-edge-suite-page", "true");

  const state = {
    context: null,
    mode: "list",
    form: null,
    scopeSearchTimer: null,
  };

  const chrome = makePageChrome();
  let route = null;

  async function refreshContext() {
    state.context = await api("get_print_profile_manager_context");
    return state.context;
  }

  function setLoading(message = "Loading print profiles...") {
    chrome.actions.replaceChildren();
    chrome.content.replaceChildren();
    const loading = node("section", "edge-state edge-state--loading edge-loading-state");
    loading.setAttribute("role", "status");
    const spinner = node("span", "edge-spinner edge-loading-spinner");
    spinner.setAttribute("aria-hidden", "true");
    loading.append(spinner, node("p", "edge-state__description", message));
    chrome.content.appendChild(loading);
  }

  function showError(error) {
    chrome.content.replaceChildren();
    const card = node("section", "edge-state edge-state--error edge-error-state");
    card.append(
      node("h2", "edge-state__title", "Print Profiles failed to load"),
      node("p", "edge-state__description", error?.message || String(error || "Unknown error")),
    );
    chrome.content.appendChild(card);
  }

  try {
    if (!globalThis.EdgeSuiteUI?.mountSharedPageShell) {
      await edgePrintProfilesRequire(EDGE_SUITE_ASSET);
    }
    const edgeUI = globalThis.EdgeSuiteUI;
    if (typeof edgeUI?.mountSharedPageShell !== "function") {
      throw new Error("EdgeSuite shared page shell is unavailable.");
    }
    try {
      await edgeUI.refreshAvailableProducts?.();
    } catch (_error) {
      // Profile management still works with server-returned product choices.
    }
    route = routeContext(edgeUI);
    wrapper._edgePrintProfilesShell?.app?.unmount?.();
    wrapper._edgePrintProfilesShell = await edgeUI.mountSharedPageShell({
      target: page.body,
      content: chrome.root,
      productKey: route.productKey,
      activeRoute: pageUrl("edge-print-profiles", route),
      fallbackMenuItems: printingFallbackMenu(route),
      tenantName: route.company,
      branchName: route.branch,
    });
  } catch (error) {
    body?.replaceChildren?.();
    body?.appendChild?.(chrome.root);
    showError(error);
    wrapper._edgePrintProfilesState = state;
    return;
  }

  function newProfile() {
    const defaults = state.context?.defaults || {};
    state.form = {
      ...defaults,
      name: "",
      profile_name: "",
      product_key: "",
      scope_type: "Global",
      scope_value: "",
    };
    state.mode = "edit";
    render();
  }

  function editProfile(profile) {
    state.form = { ...profile };
    state.mode = "edit";
    render();
  }

  function listActions() {
    chrome.actions.replaceChildren();
    chrome.actions.append(
      actionButton("Devices & Printing", () => globalThis.location.assign(pageUrl("edge-printing", route || {}))),
      actionButton("New Print Profile", newProfile, { primary: true }),
    );
  }

  function renderList() {
    listActions();
    chrome.content.replaceChildren();
    const profiles = state.context?.profiles || [];
    if (!profiles.length) {
      const empty = node("section", "edge-state edge-state--empty edge-print-profiles-empty");
      empty.append(
        node("h2", "edge-state__title", "No print profiles yet"),
        node(
          "p",
          "edge-state__description",
          "Create a profile to define paper size, printer connection settings and where that printer policy applies.",
        ),
        actionButton("Create Print Profile", newProfile, { primary: true }),
      );
      chrome.content.appendChild(empty);
      return;
    }

    const card = node("section", "edge-card edge-print-profile-list-card");
    const table = node("div", "edge-print-profile-list");
    profiles.forEach((profile) => {
      const row = node("article", "edge-print-profile-row");
      const identity = node("div", "edge-print-profile-row__identity");
      identity.append(
        node("strong", "edge-print-profile-row__name", profile.profile_name || profile.name),
        node("span", "edge-print-profile-row__meta", `${productLabel(state.context, profile.product_key)} · ${scopeLabel(profile)}`),
      );
      const printer = node("div", "edge-print-profile-row__printer");
      printer.append(
        node("span", "edge-print-profile-row__printer-title", `${profile.paper_width}mm · ${profile.text_encoding || "ASCII Safe"}`),
        node("span", "edge-print-profile-row__printer-meta", `${profile.characters_per_line} chars/line · ${profile.baud_rate} baud`),
      );
      const status = node(
        "span",
        `edge-status-badge ${profile.enabled ? "edge-status-badge--success" : "edge-status-badge--neutral"}`,
        profile.enabled ? "Enabled" : "Disabled",
      );
      row.append(identity, printer, status, actionButton("Edit", () => editProfile(profile)));
      table.appendChild(row);
    });
    card.appendChild(table);
    chrome.content.appendChild(card);
  }

  async function loadScopeSuggestions(input, datalist, scopeType, txt = "") {
    if (!scopeType || scopeType === "Global") return;
    const rows = await api("search_print_scope_values", { scope_type: scopeType, txt });
    datalist.replaceChildren();
    (rows || []).forEach((row) => {
      const option = document.createElement("option");
      option.value = row.value;
      option.label = row.label || row.value;
      datalist.appendChild(option);
    });
    input.setAttribute("list", datalist.id);
  }

  function renderEditor() {
    chrome.actions.replaceChildren();
    chrome.actions.append(actionButton("Cancel", () => {
      state.mode = "list";
      state.form = null;
      render();
    }));
    chrome.content.replaceChildren();

    const form = state.form;
    const isExisting = Boolean(form.name);
    const formRoot = node("div", "edge-print-profile-editor");

    const general = section(
      isExisting ? `Edit ${form.profile_name}` : "New Print Profile",
      "A profile is a reusable printer policy. Device permission itself remains local to each browser/device.",
    );
    const generalGrid = node("div", "edge-print-profile-grid edge-print-profile-grid--2");
    general.body.appendChild(generalGrid);

    const nameField = textField(
      "Profile Name",
      form.profile_name,
      (value) => { form.profile_name = value; },
      {
        required: true,
        readOnly: isExisting,
        placeholder: "e.g. Ketu Receipt Printer",
        helper: isExisting
          ? "Profile Name is kept stable after creation because local device bindings use it as their identifier."
          : "A clear name for this printer policy. It does not have to match the physical printer model.",
      },
    );
    const enabledField = checkboxField(
      "Enabled",
      form.enabled,
      (value) => { form.enabled = value ? 1 : 0; },
      "Disabled profiles are kept for history but are not selected for printing.",
    );
    generalGrid.append(nameField.shell, enabledField.shell);

    const productChoices = [
      { value: "", label: "No product selected (shared policy)" },
      ...(state.context?.products || []).map((product) => ({ value: product.key, label: product.label })),
    ];
    const productField = selectField(
      "Product",
      form.product_key || "",
      productChoices,
      (value) => { form.product_key = value; },
      {
        helper: "Which ProcessEdge product owns this printer policy. Required for Company or Branch scope. Leave blank only for a shared Global or User profile.",
      },
    );
    generalGrid.appendChild(productField.shell);
    generalGrid.appendChild(editorCapabilitySummary());

    const scope = section(
      "Where this profile applies",
      "More specific scopes win over broader scopes. Priority only breaks ties inside the same scope level.",
    );
    const scopeGrid = node("div", "edge-print-profile-grid edge-print-profile-grid--3");
    scope.body.appendChild(scopeGrid);

    const scopeChoices = ["Global", "Company", "Branch", "User"].map((value) => ({ value, label: value }));
    const scopeField = selectField(
      "Scope Type",
      form.scope_type || "Global",
      scopeChoices,
      (value) => {
        form.scope_type = value;
        form.scope_value = "";
        renderEditor();
      },
      {
        required: true,
        helper: "Global is the broad fallback. Company, Branch and User target a narrower printing context.",
      },
    );
    scopeGrid.appendChild(scopeField.shell);

    if (form.scope_type !== "Global") {
      const scopeValue = textField(
        `${form.scope_type}`,
        form.scope_value || "",
        (value) => {
          form.scope_value = value;
          clearTimeout(state.scopeSearchTimer);
          state.scopeSearchTimer = setTimeout(() => {
            loadScopeSuggestions(scopeValue.input, scopeDatalist, form.scope_type, value).catch(() => {});
          }, 180);
        },
        {
          required: true,
          placeholder: `Select or search ${form.scope_type.toLowerCase()}`,
          helper: `Only a valid ${form.scope_type} can be saved; backend validation remains authoritative.`,
        },
      );
      const scopeDatalist = document.createElement("datalist");
      scopeDatalist.id = `edge-print-scope-${Date.now()}`;
      scopeValue.shell.appendChild(scopeDatalist);
      scopeValue.input.addEventListener("focus", () => {
        loadScopeSuggestions(scopeValue.input, scopeDatalist, form.scope_type, form.scope_value || "").catch(() => {});
      });
      scopeGrid.appendChild(scopeValue.shell);
    }

    const priority = textField(
      "Priority",
      form.priority ?? 0,
      (value) => { form.priority = Number(value || 0); },
      {
        type: "number",
        helper: "Higher values win only when two profiles have the same Product and scope specificity.",
      },
    );
    scopeGrid.appendChild(priority.shell);

    const printer = section(
      "Printer",
      "These settings describe the physical thermal printer. Start with the manufacturer's documented values where available.",
    );
    const printerGrid = node("div", "edge-print-profile-grid edge-print-profile-grid--3");
    printer.body.appendChild(printerGrid);

    const paper = selectField(
      "Paper Width",
      String(form.paper_width || 80),
      [{ value: "58", label: "58 mm" }, { value: "80", label: "80 mm" }],
      (value) => {
        const previous = Number(form.paper_width || 80);
        form.paper_width = Number(value);
        if (Number(value) === 58 && (!form.characters_per_line || Number(form.characters_per_line) === 48 || previous === 80)) {
          form.characters_per_line = 32;
        } else if (Number(value) === 80 && (!form.characters_per_line || Number(form.characters_per_line) === 32 || previous === 58)) {
          form.characters_per_line = 48;
        }
        renderEditor();
      },
      { required: true, helper: "Thermal paper roll width. 58 mm usually uses 32 characters; 80 mm usually uses 48." },
    );
    const chars = textField(
      "Characters per Line",
      form.characters_per_line ?? 48,
      (value) => { form.characters_per_line = Number(value || 0); },
      { type: "number", min: 16, max: 80, required: true, helper: "Controls wrapping and column widths on text receipts." },
    );
    const baud = textField(
      "Baud Rate",
      form.baud_rate ?? 9600,
      (value) => { form.baud_rate = Number(value || 0); },
      { type: "number", min: 300, max: 1000000, helper: "Serial communication speed. 9600 is a safe starting point for many receipt printers." },
    );
    const encoding = selectField(
      "Text Encoding",
      form.text_encoding || "ASCII Safe",
      [{ value: "ASCII Safe", label: "ASCII Safe" }, { value: "UTF-8", label: "UTF-8" }],
      (value) => { form.text_encoding = value; },
      { helper: "ASCII Safe is the most portable option and prints the naira sign as NGN. Use UTF-8 only if the printer supports it." },
    );
    printerGrid.append(paper.shell, chars.shell, baud.shell, encoding.shell);

    const behaviour = section(
      "Receipt behaviour",
      "These settings control what the printer does after EdgeSuite has encoded a receipt.",
    );
    const behaviourGrid = node("div", "edge-print-profile-grid edge-print-profile-grid--3");
    behaviour.body.appendChild(behaviourGrid);

    const autoCut = checkboxField(
      "Auto Cut",
      form.auto_cut,
      (value) => { form.auto_cut = value ? 1 : 0; renderEditor(); },
      "Send a cutter command after the receipt if the printer has a cutter.",
    );
    behaviourGrid.appendChild(autoCut.shell);
    if (form.auto_cut) {
      const cutMode = selectField(
        "Cut Mode",
        form.cut_mode || "Partial",
        [{ value: "Partial", label: "Partial" }, { value: "Full", label: "Full" }],
        (value) => { form.cut_mode = value; },
        { helper: "Partial leaves a small paper bridge; Full requests a complete cut." },
      );
      behaviourGrid.appendChild(cutMode.shell);
    }

    const drawer = checkboxField(
      "Cash Drawer",
      form.cash_drawer,
      (value) => { form.cash_drawer = value ? 1 : 0; renderEditor(); },
      "Allow workflows that explicitly request drawer opening to pulse the connected cash drawer. Reprints never open it automatically.",
    );
    behaviourGrid.appendChild(drawer.shell);
    if (form.cash_drawer) {
      const pin = selectField(
        "Drawer Pin",
        String(form.drawer_pin ?? 0),
        [{ value: "0", label: "Pin 0" }, { value: "1", label: "Pin 1" }],
        (value) => { form.drawer_pin = Number(value); },
        { helper: "ESC/POS drawer connector pin used by the printer." },
      );
      behaviourGrid.appendChild(pin.shell);
    }

    const feed = textField(
      "Feed Lines",
      form.feed_lines ?? 3,
      (value) => { form.feed_lines = Number(value || 0); },
      { type: "number", min: 0, max: 20, helper: "Blank lines fed after receipt content before cutting or tearing." },
    );
    const copies = textField(
      "Copies",
      form.copies ?? 1,
      (value) => { form.copies = Number(value || 1); },
      { type: "number", min: 1, max: 10, helper: "Number of receipt copies printed for one print action." },
    );
    const qr = checkboxField(
      "Print QR Code",
      form.print_qr,
      (value) => { form.print_qr = value ? 1 : 0; },
      "Include product-provided QR content such as the document reference when available.",
    );
    behaviourGrid.append(feed.shell, copies.shell, qr.shell);

    const notesSection = section("Notes", "Optional internal notes for administrators.");
    const notes = textareaField("Notes", form.notes || "", (value) => { form.notes = value; });
    notesSection.body.appendChild(notes.shell);

    const footer = node("div", "edge-print-profile-editor__footer");
    const cancel = actionButton("Cancel", () => {
      state.mode = "list";
      state.form = null;
      render();
    });
    const save = actionButton(isExisting ? "Save Changes" : "Create Print Profile", async () => {
      const profileName = String(form.profile_name || "").trim();
      if (!profileName) {
        frappe.msgprint({ title: "Profile Name required", message: "Enter a Profile Name before saving.", indicator: "orange" });
        return;
      }
      if (["Company", "Branch"].includes(form.scope_type) && !form.product_key) {
        frappe.msgprint({ title: "Product required", message: "Company and Branch profiles must belong to a Product so that product can authorize the business context.", indicator: "orange" });
        return;
      }
      if (form.scope_type !== "Global" && !String(form.scope_value || "").trim()) {
        frappe.msgprint({ title: "Scope required", message: `Choose a ${form.scope_type} before saving.`, indicator: "orange" });
        return;
      }

      save.disabled = true;
      const previousLabel = save.textContent;
      save.textContent = "Saving...";
      try {
        await api("save_print_profile", { profile: JSON.stringify(form) }, "POST");
        await refreshContext();
        state.mode = "list";
        state.form = null;
        render();
        frappe.show_alert({ message: "Print profile saved", indicator: "green" });
      } catch (error) {
        frappe.msgprint({ title: "Unable to save print profile", message: error?.message || String(error), indicator: "red" });
      } finally {
        save.disabled = false;
        save.textContent = previousLabel;
      }
    }, { primary: true });
    footer.append(cancel, save);

    formRoot.append(general.wrap, scope.wrap, printer.wrap, behaviour.wrap, notesSection.wrap, footer);
    chrome.content.appendChild(formRoot);
  }

  function render() {
    if (!state.context) return;
    if (state.mode === "edit") renderEditor();
    else renderList();
  }

  setLoading();
  try {
    await refreshContext();
    render();
  } catch (error) {
    showError(error);
  }

  wrapper._edgePrintProfilesState = state;
};

frappe.pages[EDGE_PRINT_PROFILES_PAGE].on_page_show = function onPrintProfilesShow(wrapper) {
  wrapper.setAttribute("data-edge-suite-page", "true");
  suppressNativePageChrome(wrapper);
};
