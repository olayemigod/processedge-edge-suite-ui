(function installEdgeSuiteProductSwitcherFlyout(global) {
  "use strict";

  const HOST_ID = "edge-product-menu-host";
  const SOURCE_SELECT_ID = "edge-product-app-switcher";
  const LAUNCHER_ID = "edge-product-switcher-launcher";
  const FLYOUT_ID = "edge-product-switcher-flyout";
  const ASSET_URL = "/assets/edgesuite_ui/images/product-switcher.png?v=20260901-1";
  const WRAPPER_CLASS = "edge-product-switcher--launcher";
  let scheduled = false;
  let observer = null;

  function visibleElement(element) {
    if (!element?.isConnected) return false;
    const view = element.ownerDocument?.defaultView;
    let current = element;
    while (current?.nodeType === 1) {
      if (current.hidden || current.getAttribute?.("aria-hidden") === "true") return false;
      const style = view?.getComputedStyle?.(current);
      if (
        style?.display === "none" ||
        style?.visibility === "hidden" ||
        style?.contentVisibility === "hidden"
      ) {
        return false;
      }
      current = current.parentElement;
    }
    const rects = element.getClientRects?.();
    if (rects?.length) return true;
    const box = element.getBoundingClientRect?.();
    return Boolean(box && box.width > 0 && box.height > 0);
  }

  function activeEdgeShell() {
    return (
      Array.from(global.document.querySelectorAll(".edge-app-shell[data-edge-product]")).find(
        visibleElement,
      ) || null
    );
  }

  function sourceSelect() {
    return global.document.getElementById(SOURCE_SELECT_ID);
  }

  function launcher() {
    return global.document.getElementById(LAUNCHER_ID);
  }

  function flyout() {
    return global.document.getElementById(FLYOUT_ID);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function productInitials(label) {
    const words = String(label || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);
    if (!words.length) return "APP";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  }

  function productOptions(select = sourceSelect()) {
    if (!select) return [];
    return Array.from(select.options || [])
      .filter((option) => option.value && !option.disabled)
      .map((option) => ({
        key: String(option.value),
        label: String(option.textContent || option.label || option.value).trim(),
        active: option.value === select.value,
      }));
  }

  function closeFlyout({ restoreFocus = false } = {}) {
    const panel = flyout();
    const button = launcher();
    if (panel) panel.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
    if (restoreFocus) button?.focus?.();
  }

  function cleanupNativeArtifacts() {
    closeFlyout();
    flyout()?.remove();
    launcher()?.remove();
    const wrapper = sourceSelect()?.closest?.(".edge-product-switcher");
    wrapper?.classList?.remove(WRAPPER_CLASS);
  }

  function positionFlyout() {
    const button = launcher();
    const panel = flyout();
    if (!button || !panel || panel.hidden) return;

    const buttonBox = button.getBoundingClientRect();
    const viewportWidth = global.innerWidth || global.document.documentElement?.clientWidth || 0;
    const viewportHeight = global.innerHeight || global.document.documentElement?.clientHeight || 0;
    const preferredWidth = Math.min(304, Math.max(240, viewportWidth - 16));
    const left = Math.max(8, Math.min(buttonBox.right - preferredWidth, viewportWidth - preferredWidth - 8));
    panel.style.width = `${preferredWidth}px`;
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(8, buttonBox.bottom + 8)}px`;
    panel.style.maxHeight = `${Math.max(220, viewportHeight - buttonBox.bottom - 20)}px`;
  }

  function renderFlyout() {
    const select = sourceSelect();
    const panel = flyout();
    if (!select || !panel) return;

    const products = productOptions(select);
    panel.innerHTML = `
      <div class="edge-product-switcher-flyout__header">
        <div>
          <strong>Switch Product</strong>
          <span>${products.length} available ${products.length === 1 ? "app" : "apps"}</span>
        </div>
        <button type="button" class="edge-product-switcher-flyout__close" aria-label="Close Product App switcher">×</button>
      </div>
      <div class="edge-product-switcher-flyout__apps" role="menu" aria-label="Available Product Apps">
        ${products
          .map(
            (product) => `
          <button
            type="button"
            class="edge-product-switcher-flyout__app${product.active ? " is-active" : ""}"
            role="menuitemradio"
            aria-checked="${product.active ? "true" : "false"}"
            data-product-key="${escapeHtml(product.key)}"
          >
            <span class="edge-product-switcher-flyout__app-mark" aria-hidden="true">${escapeHtml(productInitials(product.label))}</span>
            <span class="edge-product-switcher-flyout__app-copy">
              <strong>${escapeHtml(product.label)}</strong>
              <small>${product.active ? "Current app" : "Open app"}</small>
            </span>
            <span class="edge-product-switcher-flyout__active-mark" aria-hidden="true">${product.active ? "✓" : "→"}</span>
          </button>`,
          )
          .join("")}
      </div>`;
  }

  function switchErrorMessage(error) {
    return (
      error?.message ||
      error?.exc ||
      error?._server_messages ||
      "Unable to switch Product App."
    );
  }

  function showSwitchError(error) {
    const message = switchErrorMessage(error);
    if (global.frappe?.msgprint) {
      global.frappe.msgprint({
        title: "Product App Switch",
        indicator: "red",
        message,
      });
    } else {
      global.console?.error?.("[EdgeSuiteUI] Product App switch failed", error);
    }
  }

  async function activateProduct(key, app) {
    const select = sourceSelect();
    if (!select || select.disabled || !key) return false;
    if (key === select.value) {
      closeFlyout({ restoreFocus: true });
      return true;
    }

    app?.setAttribute?.("aria-busy", "true");
    select.disabled = true;
    try {
      if (typeof global.EdgeSuiteUI?.switchProduct === "function") {
        await global.EdgeSuiteUI.switchProduct(key, { navigate: true });
      } else {
        select.value = key;
        select.dispatchEvent(new global.Event("change", { bubbles: true }));
      }
      closeFlyout();
      return true;
    } catch (error) {
      const activeKey = global.EdgeSuiteUI?.getActiveProduct?.()?.key || select.value;
      select.value = activeKey || select.value;
      renderFlyout();
      showSwitchError(error);
      return false;
    } finally {
      select.disabled = false;
      app?.removeAttribute?.("aria-busy");
    }
  }

  function ensureFlyout() {
    let panel = flyout();
    if (panel) return panel;
    panel = global.document.createElement("aside");
    panel.id = FLYOUT_ID;
    panel.className = "edge-product-switcher-flyout";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    global.document.body.appendChild(panel);

    panel.addEventListener("click", async (event) => {
      if (event.target.closest(".edge-product-switcher-flyout__close")) {
        closeFlyout({ restoreFocus: true });
        return;
      }
      const app = event.target.closest(".edge-product-switcher-flyout__app[data-product-key]");
      if (!app) return;
      event.preventDefault();
      event.stopPropagation();
      await activateProduct(app.dataset.productKey || "", app);
    });
    return panel;
  }

  function installLauncherIconFallback(button) {
    const image = button?.querySelector?.("img");
    const fallback = button?.querySelector?.(".edge-product-switcher__launcher-fallback");
    if (!image || !fallback || image.dataset.edgeFallbackBound === "1") return;
    image.dataset.edgeFallbackBound = "1";
    image.addEventListener("load", () => {
      image.hidden = false;
      fallback.hidden = true;
    });
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.hidden = false;
    });
    if (image.complete && !image.naturalWidth) {
      image.hidden = true;
      fallback.hidden = false;
    }
  }

  function transformSwitcher() {
    if (!activeEdgeShell()) {
      cleanupNativeArtifacts();
      return false;
    }

    const host = global.document.getElementById(HOST_ID);
    const select = sourceSelect();
    const products = productOptions(select);
    if (!host || !select || products.length <= 1) {
      closeFlyout();
      flyout()?.remove();
      launcher()?.remove();
      return false;
    }

    let wrapper = select.closest(".edge-product-switcher");
    if (!wrapper) return false;

    if (wrapper.tagName === "LABEL") {
      const replacement = global.document.createElement("span");
      replacement.className = wrapper.className;
      wrapper.parentNode?.insertBefore(replacement, wrapper);
      replacement.appendChild(select);
      wrapper.remove();
      wrapper = replacement;
    }

    wrapper.classList.add(WRAPPER_CLASS);
    wrapper.setAttribute("aria-label", "Product App switcher");
    wrapper.querySelectorAll(".edge-product-switcher__icon, .edge-product-switcher__chevron").forEach((node) => node.remove());
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    let button = launcher();
    if (!button) {
      button = global.document.createElement("button");
      button.id = LAUNCHER_ID;
      button.type = "button";
      button.className = "edge-product-switcher__launcher";
      button.setAttribute("aria-haspopup", "menu");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", FLYOUT_ID);
      button.setAttribute("aria-label", "Switch Product App");
      button.title = "Switch Product App";
      button.innerHTML = `
        <img src="${ASSET_URL}" alt="" aria-hidden="true" />
        <span class="edge-product-switcher__launcher-fallback" aria-hidden="true" hidden style="font-size:1.2rem;font-weight:700;line-height:1">⇄</span>`;
      wrapper.insertBefore(button, select);
      installLauncherIconFallback(button);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        global.EdgeSuiteUI?.closeProductMenu?.();
        const panel = ensureFlyout();
        renderFlyout();
        const shouldOpen = panel.hidden;
        closeFlyout();
        if (shouldOpen) {
          panel.hidden = false;
          button.setAttribute("aria-expanded", "true");
          positionFlyout();
          global.requestAnimationFrame?.(() =>
            panel.querySelector(".edge-product-switcher-flyout__app.is-active")?.focus?.(),
          );
        }
      });
    } else {
      const image = button.querySelector("img");
      if (image && image.getAttribute("src") !== ASSET_URL) image.setAttribute("src", ASSET_URL);
      installLauncherIconFallback(button);
    }

    ensureFlyout();
    renderFlyout();
    return true;
  }

  function reconcile() {
    scheduled = false;
    transformSwitcher();
  }

  function scheduleReconcile() {
    if (scheduled) return;
    scheduled = true;
    (global.requestAnimationFrame || global.setTimeout)?.(reconcile, 0);
  }

  global.document.addEventListener("click", (event) => {
    const panel = flyout();
    const button = launcher();
    if (!panel || panel.hidden) return;
    if (panel.contains(event.target) || button?.contains(event.target)) return;
    closeFlyout();
  });

  global.document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && flyout() && !flyout().hidden) {
      event.preventDefault();
      closeFlyout({ restoreFocus: true });
    }
  });

  global.document.addEventListener("edgesuite:product-context-changed", scheduleReconcile);
  ["DOMContentLoaded", "toolbar_setup", "sidebar_setup", "desktop_screen", "page-change"].forEach(
    (eventName) => global.document.addEventListener(eventName, scheduleReconcile),
  );
  ["resize", "orientationchange", "hashchange", "popstate", "pageshow"].forEach((eventName) =>
    global.addEventListener?.(eventName, () => {
      scheduleReconcile();
      positionFlyout();
    }),
  );
  global.addEventListener?.("scroll", positionFlyout, true);
  global.frappe?.router?.on?.("change", scheduleReconcile);

  if (global.MutationObserver && global.document.body) {
    observer = new global.MutationObserver(scheduleReconcile);
    observer.observe(global.document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "disabled"],
    });
  }

  global.EdgeSuiteProductSwitcherFlyout = {
    reconcile,
    close: closeFlyout,
    position: positionFlyout,
    state: () => ({
      active_shell: Boolean(activeEdgeShell()),
      launcher_present: Boolean(launcher()),
      flyout_open: Boolean(flyout() && !flyout().hidden),
      available_products: productOptions(),
    }),
    observer,
  };

  scheduleReconcile();
})(window);
