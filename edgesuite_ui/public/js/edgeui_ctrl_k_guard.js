(() => {
  const GUARD_KEY = "__edgeSuiteCtrlKGuard";

  if (globalThis[GUARD_KEY]) return;

  function isMac() {
    return /Mac|iPhone|iPad|iPod/i.test(
      globalThis.navigator?.platform || globalThis.navigator?.userAgent || "",
    );
  }

  function usesPrimaryModifier(event) {
    return isMac() ? event.metaKey : event.ctrlKey;
  }

  function runtime() {
    return globalThis.EdgeSuiteUI || globalThis.EdgeUI || null;
  }

  function focusProductMenuSearch() {
    globalThis.requestAnimationFrame?.(() => {
      globalThis.requestAnimationFrame?.(() => {
        const search = globalThis.document?.querySelector?.(
          "#edge-product-menu-dropdown:not([hidden]) .edge-product-menu__search",
        );
        search?.focus?.({ preventScroll: true });
        search?.select?.();
      });
    });
  }

  function onKeydown(event) {
    if (!usesPrimaryModifier(event) || event.altKey) return;
    if (String(event.key || "").toLowerCase() !== "k") return;

    const edgeRuntime = runtime();
    if (typeof edgeRuntime?.openProductMenu !== "function") return;

    const opened = edgeRuntime.openProductMenu();
    if (!opened) return;

    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation?.();
    focusProductMenuSearch();
  }

  globalThis.addEventListener?.("keydown", onKeydown, true);
  globalThis[GUARD_KEY] = {
    destroy() {
      globalThis.removeEventListener?.("keydown", onKeydown, true);
      delete globalThis[GUARD_KEY];
    },
  };
})();
