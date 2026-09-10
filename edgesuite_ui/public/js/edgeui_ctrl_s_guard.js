(() => {
  const GUARD_KEY = "__edgeSuiteCtrlSGuard";

  if (globalThis[GUARD_KEY]) return;

  let saveInFlight = null;

  function isMac() {
    return /Mac|iPhone|iPad|iPod/i.test(
      globalThis.navigator?.platform || globalThis.navigator?.userAgent || "",
    );
  }

  function usesPrimaryModifier(event) {
    return isMac() ? event.metaKey : event.ctrlKey;
  }

  function editingSurface(target) {
    if (!target?.closest) return false;
    return Boolean(
      target.closest(
        "textarea, input, [contenteditable='true'], .ql-editor, .CodeMirror, .ace_editor, .monaco-editor",
      ),
    );
  }

  function editorOwnsSaveShortcut(target) {
    if (!target?.closest) return false;
    return Boolean(target.closest(".CodeMirror, .ace_editor, .monaco-editor"));
  }

  function visible(element) {
    if (!element || element.hidden || !element.getClientRects?.().length) return false;
    const style = globalThis.getComputedStyle?.(element);
    return style?.display !== "none" && style?.visibility !== "hidden";
  }

  function notify(message, indicator = "blue") {
    globalThis.frappe?.show_alert?.(
      {
        message: globalThis.__ ? globalThis.__(message) : message,
        indicator,
      },
      4,
    );
  }

  function activeFrappeForm() {
    const form = globalThis.cur_frm;
    if (!form?.doc || typeof form.save !== "function") return null;

    const route = globalThis.frappe?.get_route?.();
    if (Array.isArray(route) && route.length) {
      const routeType = String(route[0] || "").trim().toLowerCase();
      if (routeType && routeType !== "form") return null;
    }

    const wrapper = form.page?.wrapper || form.wrapper;
    if (wrapper && !visible(wrapper)) return null;
    return form;
  }

  async function saveActiveFrappeForm(form) {
    if (Number(form.doc.docstatus || 0) !== 0) {
      notify("Submitted documents cannot be changed with this shortcut.", "orange");
      return true;
    }
    if (typeof form.is_dirty === "function" && !form.is_dirty()) {
      notify("No unsaved changes.");
      return true;
    }
    await form.save();
    return true;
  }

  async function saveViaRequestEvent() {
    if (typeof globalThis.dispatchEvent !== "function" || typeof globalThis.CustomEvent !== "function") {
      return false;
    }
    const detail = { handled: false, promise: null, source: "keyboard", command: "save" };
    globalThis.dispatchEvent(new globalThis.CustomEvent("edgesuite:save-request", { detail }));
    if (!detail.handled) return false;
    if (detail.promise && typeof detail.promise.then === "function") await detail.promise;
    return true;
  }

  async function saveCurrentContext() {
    const form = activeFrappeForm();
    if (form) return saveActiveFrappeForm(form);

    if (await saveViaRequestEvent()) return true;

    const runtime = globalThis.EdgeSuiteUI || globalThis.EdgeUI;
    if (typeof runtime?.saveCurrentContext === "function") {
      return runtime.saveCurrentContext();
    }

    notify("No save action is available on this page.");
    return false;
  }

  function onKeydown(event) {
    if (!usesPrimaryModifier(event) || event.altKey) return;
    if (String(event.key || "").toLowerCase() !== "s") return;

    // Embedded code editors may implement their own save command. Normal form
    // inputs, textareas and rich-text/contenteditable surfaces still use the
    // page/document save contract.
    const isEditing = editingSurface(event.target);
    if (isEditing && editorOwnsSaveShortcut(event.target)) return;

    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation?.();

    if (saveInFlight) return;

    saveInFlight = Promise.resolve()
      .then(saveCurrentContext)
      .catch((error) => {
        globalThis.console?.error?.("EdgeSuite save command failed", error);
        notify(error?.message || "Unable to save the current page.", "red");
      })
      .finally(() => {
        saveInFlight = null;
      });
  }

  globalThis.addEventListener?.("keydown", onKeydown, true);
  globalThis[GUARD_KEY] = {
    destroy() {
      globalThis.removeEventListener?.("keydown", onKeydown, true);
      saveInFlight = null;
      delete globalThis[GUARD_KEY];
    },
  };
})();
