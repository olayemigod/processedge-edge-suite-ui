const RUNTIME_KEY = "__edgeDropdownViewportRuntimeV1";
const MENU_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;
const MAX_MENU_HEIGHT_PX = 288;
const MIN_USABLE_HEIGHT_PX = 72;
const FLIP_THRESHOLD_PX = 160;

function viewportHeight(globalObject) {
  return (
    globalObject?.document?.documentElement?.clientHeight ||
    globalObject?.innerHeight ||
    0
  );
}

function resetClosedDropdowns(documentObject) {
  documentObject
    .querySelectorAll(".edge-dropdown[data-edge-dropdown-direction]:not(.is-open)")
    .forEach((root) => {
      root.removeAttribute("data-edge-dropdown-direction");
      const menu = root.querySelector(".edge-dropdown__menu");
      if (!menu) return;
      menu.style.removeProperty("top");
      menu.style.removeProperty("bottom");
      menu.style.removeProperty("max-height");
    });
}

function positionDropdown(root, globalObject) {
  if (!root?.classList?.contains("is-open")) return;
  const trigger = root.querySelector(".edge-dropdown__trigger");
  const menu = root.querySelector(".edge-dropdown__menu");
  if (!trigger || !menu) return;

  const height = viewportHeight(globalObject);
  if (!height) return;

  const rect = trigger.getBoundingClientRect();
  const spaceBelow = Math.max(0, height - rect.bottom - MENU_GAP_PX - VIEWPORT_MARGIN_PX);
  const spaceAbove = Math.max(0, rect.top - MENU_GAP_PX - VIEWPORT_MARGIN_PX);
  const desiredHeight = Math.min(
    MAX_MENU_HEIGHT_PX,
    Math.max(MIN_USABLE_HEIGHT_PX, menu.scrollHeight || menu.offsetHeight || MAX_MENU_HEIGHT_PX),
  );
  const openUpward =
    spaceBelow < Math.min(desiredHeight, FLIP_THRESHOLD_PX) && spaceAbove > spaceBelow;
  const availableHeight = openUpward ? spaceAbove : spaceBelow;

  root.dataset.edgeDropdownDirection = openUpward ? "up" : "down";
  menu.style.maxHeight = `${Math.max(
    MIN_USABLE_HEIGHT_PX,
    Math.min(MAX_MENU_HEIGHT_PX, availableHeight || desiredHeight),
  )}px`;

  if (openUpward) {
    menu.style.top = "auto";
    menu.style.bottom = "calc(100% + .25rem)";
  } else {
    menu.style.top = "calc(100% + .25rem)";
    menu.style.bottom = "auto";
  }
}

export function installDropdownViewportRuntime(globalObject = globalThis) {
  const documentObject = globalObject?.document;
  if (!documentObject) return { installed: false, reason: "document-unavailable" };
  if (globalObject[RUNTIME_KEY]?.installed) return globalObject[RUNTIME_KEY];

  let frame = 0;
  const schedule = () => {
    if (frame) globalObject.cancelAnimationFrame?.(frame);
    const run = () => {
      frame = 0;
      documentObject
        .querySelectorAll(".edge-dropdown.is-open")
        .forEach((root) => positionDropdown(root, globalObject));
      resetClosedDropdowns(documentObject);
    };
    if (typeof globalObject.requestAnimationFrame === "function") {
      frame = globalObject.requestAnimationFrame(run);
    } else {
      globalObject.setTimeout?.(run, 0);
    }
  };

  documentObject.addEventListener("click", schedule, true);
  documentObject.addEventListener("keydown", schedule, true);
  globalObject.addEventListener?.("resize", schedule);
  globalObject.addEventListener?.("scroll", schedule, true);

  const runtime = {
    installed: true,
    refresh: schedule,
    destroy() {
      documentObject.removeEventListener("click", schedule, true);
      documentObject.removeEventListener("keydown", schedule, true);
      globalObject.removeEventListener?.("resize", schedule);
      globalObject.removeEventListener?.("scroll", schedule, true);
      if (frame) globalObject.cancelAnimationFrame?.(frame);
      frame = 0;
      resetClosedDropdowns(documentObject);
      delete globalObject[RUNTIME_KEY];
    },
  };

  globalObject[RUNTIME_KEY] = runtime;
  return runtime;
}

export default installDropdownViewportRuntime;
