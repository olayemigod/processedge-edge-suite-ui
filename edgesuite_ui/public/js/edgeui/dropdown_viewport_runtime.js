const RUNTIME_KEY = "__edgeDropdownViewportRuntimeV1";
const MENU_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;
const MAX_MENU_HEIGHT_PX = 288;
const MIN_USABLE_HEIGHT_PX = 72;
const FLIP_THRESHOLD_PX = 160;

const SMART_DATE_GAP_PX = 8;
const SMART_DATE_VIEWPORT_MARGIN_PX = 12;
const SMART_DATE_MAX_WIDTH_PX = 560;
const SMART_DATE_MAX_HEIGHT_PX = 672;
const SMART_DATE_MIN_USABLE_HEIGHT_PX = 96;
const SMART_DATE_FLIP_THRESHOLD_PX = 280;

function viewportHeight(globalObject) {
  return (
    globalObject?.document?.documentElement?.clientHeight ||
    globalObject?.innerHeight ||
    0
  );
}

function viewportWidth(globalObject) {
  return (
    globalObject?.document?.documentElement?.clientWidth ||
    globalObject?.innerWidth ||
    0
  );
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
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

function resetClosedSmartDates(documentObject) {
  documentObject
    .querySelectorAll(".edge-smart-date[data-edge-smart-date-direction]:not(.is-open)")
    .forEach((root) => {
      root.removeAttribute("data-edge-smart-date-direction");
      root.removeAttribute("data-edge-smart-date-align");
      const picker = root.querySelector(".edge-smart-date__picker");
      if (!picker) return;
      for (const property of ["position", "left", "right", "top", "bottom", "width", "max-height"]) {
        picker.style.removeProperty(property);
      }
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

function positionSmartDate(root, globalObject) {
  if (!root?.classList?.contains("is-open")) return;
  const trigger = root.querySelector(".edge-smart-date__trigger");
  const picker = root.querySelector(".edge-smart-date__picker");
  if (!trigger || !picker) return;

  const width = viewportWidth(globalObject);
  const height = viewportHeight(globalObject);
  if (!width || !height) return;

  const rect = trigger.getBoundingClientRect();
  const availableViewportWidth = Math.max(0, width - SMART_DATE_VIEWPORT_MARGIN_PX * 2);
  const pickerWidth = Math.min(SMART_DATE_MAX_WIDTH_PX, availableViewportWidth);
  if (!pickerWidth) return;

  const spaceBelow = Math.max(
    0,
    height - rect.bottom - SMART_DATE_GAP_PX - SMART_DATE_VIEWPORT_MARGIN_PX,
  );
  const spaceAbove = Math.max(
    0,
    rect.top - SMART_DATE_GAP_PX - SMART_DATE_VIEWPORT_MARGIN_PX,
  );
  const naturalHeight = Math.max(
    SMART_DATE_MIN_USABLE_HEIGHT_PX,
    picker.scrollHeight || picker.offsetHeight || SMART_DATE_MIN_USABLE_HEIGHT_PX,
  );
  const desiredHeight = Math.min(SMART_DATE_MAX_HEIGHT_PX, naturalHeight);
  const openUpward =
    spaceBelow < Math.min(desiredHeight, SMART_DATE_FLIP_THRESHOLD_PX) && spaceAbove > spaceBelow;
  const availableHeight = openUpward ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(
    Math.min(SMART_DATE_MIN_USABLE_HEIGHT_PX, Math.max(spaceAbove, spaceBelow)),
    Math.min(SMART_DATE_MAX_HEIGHT_PX, availableHeight || desiredHeight),
  );

  const preferredStart = rect.left;
  const preferredEnd = rect.right - pickerWidth;
  const maxLeft = Math.max(
    SMART_DATE_VIEWPORT_MARGIN_PX,
    width - SMART_DATE_VIEWPORT_MARGIN_PX - pickerWidth,
  );
  const canOpenToRight = preferredStart + pickerWidth <= width - SMART_DATE_VIEWPORT_MARGIN_PX;
  const canOpenToLeft = preferredEnd >= SMART_DATE_VIEWPORT_MARGIN_PX;

  let align = "start";
  let left = preferredStart;
  if (!canOpenToRight && canOpenToLeft) {
    align = "end";
    left = preferredEnd;
  } else if (!canOpenToRight) {
    align = "clamped";
    left = clamp(preferredStart, SMART_DATE_VIEWPORT_MARGIN_PX, maxLeft);
  } else {
    left = clamp(preferredStart, SMART_DATE_VIEWPORT_MARGIN_PX, maxLeft);
    if (left !== preferredStart) align = "clamped";
  }

  root.dataset.edgeSmartDateDirection = openUpward ? "up" : "down";
  root.dataset.edgeSmartDateAlign = align;

  picker.style.position = "fixed";
  picker.style.width = `${pickerWidth}px`;
  picker.style.left = `${left}px`;
  picker.style.right = "auto";
  picker.style.maxHeight = `${Math.max(1, maxHeight)}px`;

  if (openUpward) {
    picker.style.top = "auto";
    picker.style.bottom = `${Math.max(
      SMART_DATE_VIEWPORT_MARGIN_PX,
      height - rect.top + SMART_DATE_GAP_PX,
    )}px`;
  } else {
    picker.style.top = `${Math.min(
      height - SMART_DATE_VIEWPORT_MARGIN_PX,
      rect.bottom + SMART_DATE_GAP_PX,
    )}px`;
    picker.style.bottom = "auto";
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
      documentObject
        .querySelectorAll(".edge-smart-date.is-open")
        .forEach((root) => positionSmartDate(root, globalObject));
      resetClosedDropdowns(documentObject);
      resetClosedSmartDates(documentObject);
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
      resetClosedSmartDates(documentObject);
      delete globalObject[RUNTIME_KEY];
    },
  };

  globalObject[RUNTIME_KEY] = runtime;
  return runtime;
}

export default installDropdownViewportRuntime;
