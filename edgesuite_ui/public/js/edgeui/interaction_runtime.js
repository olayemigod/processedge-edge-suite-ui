const COMMAND_VERSION = "1.0.0";
const DENSITY_VERSION = "v1";
const DENSITY_MODES = new Set(["comfortable", "compact", "touch"]);
const ACCORDION_RECONCILE_DELAY = 0;
const PRODUCT_MENU_OPEN_SECTION_KEY = "edgeOpenSection";

function targetDocument(target) {
  return target?.document || null;
}

function currentUser(target) {
  return target?.frappe?.session?.user || "Guest";
}

function normalizedProduct(value) {
  return (
    String(value || "edgesuite")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "edgesuite"
  );
}

function activeProduct(target, runtime) {
  const shell = targetDocument(target)?.querySelector?.(".edge-app-shell[data-edge-product]");
  return normalizedProduct(
    shell?.getAttribute("data-edge-product") ||
      runtime?.getProductMenuConfig?.()?.product_key ||
      runtime?.getProductMenuConfig?.()?.product ||
      runtime?.getProductContext?.()?.active_product ||
      "edgesuite",
  );
}

function preferenceKey(target, product, kind, version) {
  return `edgeui:${normalizedProduct(product)}:${kind}:${version}:${currentUser(target)}`;
}

function isMac(target) {
  return /Mac|iPhone|iPad|iPod/i.test(
    target?.navigator?.platform || target?.navigator?.userAgent || "",
  );
}

function primaryModifier(target, event) {
  return isMac(target) ? event.metaKey : event.ctrlKey;
}

function editingSurface(target) {
  if (!target?.closest) return false;
  return Boolean(
    target.closest(
      "textarea, [contenteditable='true'], .ql-editor, .CodeMirror, .ace_editor, .monaco-editor",
    ),
  );
}

function visible(element, target) {
  if (!element || element.hidden || !element.getClientRects?.().length) return false;
  const style = target?.getComputedStyle?.(element);
  return style?.display !== "none" && style?.visibility !== "hidden";
}

function notify(target, message, indicator = "blue") {
  target?.frappe?.show_alert?.({ message: target?.__ ? target.__(message) : message, indicator }, 4);
}

function explicitSaveControl(target) {
  const document = targetDocument(target);
  if (!document) return null;
  return [...document.querySelectorAll("[data-edgesuite-save]:not([disabled])")]
    .reverse()
    .find((element) => visible(element, target)) || null;
}

function createCommandController({ runtime, target = globalThis } = {}) {
  const handlers = new Map();
  let activeHandler = "";
  let bound = false;

  function registerSaveHandler(key, handler, { activate = true } = {}) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || typeof handler !== "function") return () => {};
    handlers.set(normalizedKey, handler);
    if (activate) activeHandler = normalizedKey;
    return () => {
      handlers.delete(normalizedKey);
      if (activeHandler === normalizedKey) activeHandler = "";
    };
  }

  function activateSaveHandler(key) {
    const normalizedKey = String(key || "").trim();
    activeHandler = handlers.has(normalizedKey) ? normalizedKey : "";
    return Boolean(activeHandler);
  }

  async function invokeRegisteredSave() {
    const handler = activeHandler ? handlers.get(activeHandler) : null;
    if (!handler) return false;
    const result = await handler({ source: "keyboard", command: "save" });
    return result !== false;
  }

  async function invokeEventSave() {
    if (typeof target?.CustomEvent !== "function") return false;
    const detail = { handled: false, promise: null, source: "keyboard", command: "save" };
    target.dispatchEvent?.(new target.CustomEvent("edgesuite:save-request", { detail }));
    if (!detail.handled) return false;
    if (detail.promise && typeof detail.promise.then === "function") await detail.promise;
    return true;
  }

  async function invokeExplicitSaveControl() {
    const control = explicitSaveControl(target);
    if (!control) return false;
    control.click();
    return true;
  }

  async function invokeFrappeFormSave() {
    const form = target?.cur_frm;
    if (!form?.doc || typeof form.save !== "function") return false;
    if (Number(form.doc.docstatus || 0) !== 0) {
      notify(target, "Submitted documents cannot be changed with this shortcut.", "orange");
      return true;
    }
    if (typeof form.is_dirty === "function" && !form.is_dirty()) {
      notify(target, "No unsaved changes.");
      return true;
    }
    await form.save();
    return true;
  }

  async function saveCurrentContext() {
    try {
      if (await invokeRegisteredSave()) return true;
      if (await invokeEventSave()) return true;
      if (await invokeExplicitSaveControl()) return true;
      return await invokeFrappeFormSave();
    } catch (error) {
      target?.console?.error?.("EdgeSuite save command failed", error);
      notify(target, error?.message || "Unable to save the current page.", "red");
      return true;
    }
  }

  function openCommandPalette() {
    if (runtime?.openProductMenu?.()) return true;
    if (typeof target?.CustomEvent !== "function") return false;
    const detail = { handled: false, source: "keyboard", command: "search" };
    target.dispatchEvent?.(new target.CustomEvent("edgesuite:command-palette-request", { detail }));
    return Boolean(detail.handled);
  }

  async function onKeydown(event) {
    if (!primaryModifier(target, event) || event.altKey) return;
    const key = String(event.key || "").toLowerCase();
    if (key === "s") {
      if (editingSurface(event.target) && !event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      await saveCurrentContext();
      return;
    }
    if (key === "k") {
      event.preventDefault();
      event.stopPropagation();
      openCommandPalette();
    }
  }

  function bind() {
    if (bound || !targetDocument(target)) return;
    bound = true;
    targetDocument(target).addEventListener("keydown", onKeydown, true);
  }

  function destroy() {
    if (bound) targetDocument(target)?.removeEventListener("keydown", onKeydown, true);
    bound = false;
    handlers.clear();
    activeHandler = "";
  }

  bind();
  return {
    version: COMMAND_VERSION,
    registerSaveHandler,
    activateSaveHandler,
    saveCurrentContext,
    openCommandPalette,
    destroy,
  };
}

function createDensityController({ runtime, target = globalThis } = {}) {
  function product() {
    return activeProduct(target, runtime);
  }

  function getDensity() {
    try {
      const stored = target?.localStorage?.getItem(
        preferenceKey(target, product(), "density", DENSITY_VERSION),
      );
      return DENSITY_MODES.has(stored) ? stored : "compact";
    } catch (_error) {
      return "compact";
    }
  }

  function applyDensity(mode = getDensity()) {
    const next = DENSITY_MODES.has(mode) ? mode : "compact";
    const document = targetDocument(target);
    if (document?.documentElement) document.documentElement.dataset.edgeDensity = next;
    if (document?.body) document.body.dataset.edgeDensity = next;
    return next;
  }

  function setDensity(mode) {
    const next = DENSITY_MODES.has(mode) ? mode : "compact";
    try {
      target?.localStorage?.setItem(
        preferenceKey(target, product(), "density", DENSITY_VERSION),
        next,
      );
    } catch (_error) {
      // Browser storage is optional. The current page still receives the density.
    }
    applyDensity(next);
    if (typeof target?.CustomEvent === "function") {
      target.dispatchEvent?.(
        new target.CustomEvent("edgesuite:density-changed", {
          detail: { product: product(), density: next },
        }),
      );
    }
    return next;
  }

  applyDensity();
  return { getDensity, setDensity, applyDensity };
}

function sectionExpanded(section) {
  const items = section?.querySelector?.(".edge-sidebar__items");
  return Boolean(section && !section.classList.contains("is-collapsed") && !items?.hidden);
}

function closeSection(section) {
  if (!sectionExpanded(section)) return;
  section.querySelector?.(".edge-sidebar__section-toggle")?.click();
}

function reconcileSidebar(shell, preferredSection = null) {
  if (!shell || shell.dataset.edgeMultiSection === "true") return;
  const sections = [...shell.querySelectorAll(".edge-sidebar__section")];
  const expanded = sections.filter(sectionExpanded);
  if (expanded.length <= 1) return;
  const active = sections.find((section) => section.querySelector(".edge-sidebar-item.active"));
  const keep = preferredSection && sectionExpanded(preferredSection)
    ? preferredSection
    : active && sectionExpanded(active)
      ? active
      : expanded[0];
  expanded.filter((section) => section !== keep).forEach(closeSection);
}

function productSectionIdentity(section) {
  return String(section?.getAttribute?.("aria-label") || "").trim();
}

function enhanceProductMenu(panel) {
  if (!panel || panel.dataset.edgeAccordionEnhanced === "1") return;
  panel.dataset.edgeAccordionEnhanced = "1";
  panel.addEventListener("click", (event) => {
    const heading = event.target?.closest?.(".edge-product-menu__section-heading");
    if (!heading || event.target?.closest?.(".edge-product-menu__item")) return;
    const section = heading.closest(".edge-product-menu__section");
    const items = section?.querySelector(".edge-product-menu__items");
    if (!section || !items) return;
    const nextCollapsed = !section.classList.contains("is-collapsed");
    for (const sibling of panel.querySelectorAll(".edge-product-menu__section")) {
      const siblingItems = sibling.querySelector(".edge-product-menu__items");
      const collapse = sibling === section ? nextCollapsed : true;
      sibling.classList.toggle("is-collapsed", collapse);
      if (siblingItems) siblingItems.hidden = collapse;
      sibling.querySelector(".edge-product-menu__section-heading")?.setAttribute(
        "aria-expanded",
        collapse ? "false" : "true",
      );
    }
    if (nextCollapsed) delete panel.dataset[PRODUCT_MENU_OPEN_SECTION_KEY];
    else panel.dataset[PRODUCT_MENU_OPEN_SECTION_KEY] = productSectionIdentity(section);
  });
  panel.addEventListener("keydown", (event) => {
    if (!event.target?.matches?.(".edge-product-menu__section-heading")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.target.click();
  });
}

function reconcileProductMenu(panel) {
  if (!panel || panel.hidden) return;
  enhanceProductMenu(panel);
  const query = String(panel.querySelector(".edge-product-menu__search")?.value || "").trim();
  const sections = [...panel.querySelectorAll(".edge-product-menu__section")];
  if (!sections.length) return;
  const preferredIdentity = panel.dataset[PRODUCT_MENU_OPEN_SECTION_KEY] || "";
  const preferred = preferredIdentity
    ? sections.find((section) => productSectionIdentity(section) === preferredIdentity)
    : null;
  if (preferredIdentity && !preferred) delete panel.dataset[PRODUCT_MENU_OPEN_SECTION_KEY];
  const active = sections.find((section) => section.querySelector(".edge-product-menu__item.is-active"));
  const keep = query ? null : preferred || active || sections[0];
  for (const section of sections) {
    const heading = section.querySelector(".edge-product-menu__section-heading");
    const items = section.querySelector(".edge-product-menu__items");
    if (heading) {
      heading.tabIndex = 0;
      heading.setAttribute("role", "button");
    }
    const collapse = query ? false : section !== keep;
    section.classList.toggle("is-collapsed", collapse);
    if (items) items.hidden = collapse;
    heading?.setAttribute("aria-expanded", collapse ? "false" : "true");
  }
}

function installAccordionRuntime({ target = globalThis } = {}) {
  const document = targetDocument(target);
  if (!document || target.__edgeSuiteAccordionRuntimeBound) return;
  target.__edgeSuiteAccordionRuntimeBound = true;

  document.addEventListener("click", (event) => {
    const toggle = event.target?.closest?.(".edge-sidebar__section-toggle");
    if (!toggle) return;
    const section = toggle.closest(".edge-sidebar__section");
    const shell = toggle.closest(".edge-app-shell");
    target.setTimeout?.(() => reconcileSidebar(shell, section), ACCORDION_RECONCILE_DELAY);
  });

  const reconcileAll = () => {
    document.querySelectorAll(".edge-app-shell").forEach((shell) => reconcileSidebar(shell));
    reconcileProductMenu(document.getElementById("edge-product-menu-dropdown"));
  };

  const reconcileForNavigation = () => {
    const panel = document.getElementById("edge-product-menu-dropdown");
    if (panel) delete panel.dataset[PRODUCT_MENU_OPEN_SECTION_KEY];
    reconcileAll();
  };

  document.addEventListener("page-change", reconcileForNavigation);
  target.frappe?.router?.on?.("change", reconcileForNavigation);
  if (target.MutationObserver && document.body) {
    const observer = new target.MutationObserver(reconcileAll);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  reconcileAll();
}

export function installEdgeSuiteInteractionRuntime(runtime, target = globalThis) {
  if (!runtime || runtime.__interactionRuntimeInstalled) return runtime;
  const commands = createCommandController({ runtime, target });
  const density = createDensityController({ runtime, target });
  installAccordionRuntime({ target });

  runtime.commands = commands;
  runtime.density = density;
  runtime.registerSaveHandler = commands.registerSaveHandler;
  runtime.activateSaveHandler = commands.activateSaveHandler;
  runtime.saveCurrentContext = commands.saveCurrentContext;
  runtime.openCommandPalette = commands.openCommandPalette;
  runtime.getDensity = density.getDensity;
  runtime.setDensity = density.setDensity;
  runtime.applyDensity = density.applyDensity;
  runtime.__interactionRuntimeInstalled = true;

  target.EdgeSuiteCommands = commands;
  return runtime;
}

export { COMMAND_VERSION, DENSITY_MODES };
