(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  const HOST_CLASS = "edge-frappe-dialog-host";
  const DIALOG_CLASS = "edge-frappe-dialog";
  const SURFACE_CLASS = "edge-frappe-dialog__surface";

  function activeProduct() {
    return (
      document.querySelector(".edge-app-shell[data-edge-product]")?.getAttribute("data-edge-product") ||
      document.body?.className
        ?.split(/\s+/)
        .find((name) => name.startsWith("edge-suite-product-"))
        ?.replace("edge-suite-product-", "") ||
      "edgesuite"
    );
  }

  function decorate(modal) {
    if (!(modal instanceof Element) || !modal.matches(".modal")) return;
    const dialog = modal.querySelector(".modal-dialog");
    const content = dialog?.querySelector(":scope > .modal-content") || modal.querySelector(".modal-content");
    if (!dialog || !content) return;

    modal.classList.add(HOST_CLASS);
    dialog.classList.add(DIALOG_CLASS);
    content.classList.add(SURFACE_CLASS);
    modal.dataset.edgeProduct = activeProduct();

    modal.querySelector(".modal-header")?.classList.add("edge-frappe-dialog__header");
    modal.querySelector(".modal-body")?.classList.add("edge-frappe-dialog__body");
    modal.querySelector(".modal-footer")?.classList.add("edge-frappe-dialog__footer");

    if (
      modal.classList.contains("msgprint-dialog") ||
      dialog.classList.contains("msgprint-dialog") ||
      modal.querySelector(".msgprint") ||
      modal.querySelector(".msgprint-message")
    ) {
      modal.classList.add("edge-frappe-dialog-host--message");
    }
  }

  function scan(root = document) {
    if (root instanceof Element && root.matches(".modal")) decorate(root);
    root.querySelectorAll?.(".modal").forEach(decorate);
  }

  function inspectAdded(node) {
    if (!(node instanceof Element)) return;
    scan(node);
  }

  function install() {
    scan(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(inspectAdded);
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

    document.addEventListener("show.bs.modal", (event) => decorate(event.target), true);
    document.addEventListener("shown.bs.modal", (event) => decorate(event.target), true);

    window.EdgeSuiteFrappeDialogBridge = {
      decorate,
      scan,
      installed: true,
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
