const RUNTIME_KEY = "__edgeDropdownViewportRuntimeV1";
const MENU_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;
const MAX_MENU_HEIGHT_PX = 288;
const MIN_USABLE_HEIGHT_PX = 72;
const FLIP_THRESHOLD_PX = 160;

const SMART_DATE_GAP_PX = 7;
const SMART_DATE_MAX_WIDTH_PX = 560;
const SMART_DATE_MAX_HEIGHT_PX = 672;
const SMART_DATE_MIN_USABLE_HEIGHT_PX = 120;
const SMART_DATE_MIN_USABLE_WIDTH_PX = 280;

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

function smartDateSiblingRects(root) {
  const fieldRoot = root?.parentElement || root;
  const container = fieldRoot?.parentElement;
  if (!container?.children) return [];
  return Array.from(container.children)
    .filter((element) => element !== fieldRoot && !element.contains(root))
    .map((element) => element.getBoundingClientRect?.())
    .filter((rect) => rect && rect.width > 0 && rect.height > 0);
}

function intersectionArea(candidate, rect) {
  const width = Math.max(0, Math.min(candidate.right, rect.right) - Math.max(candidate.left, rect.left));
  const height = Math.max(0, Math.min(candidate.bottom, rect.bottom) - Math.max(candidate.top, rect.top));
  return width * height;
}

function placementScore(candidate, siblingRects, width, height, preference) {
  const overflow =
    Math.max(0, VIEWPORT_MARGIN_PX - candidate.left) +
    Math.max(0, candidate.right - (width - VIEWPORT_MARGIN_PX)) +
    Math.max(0, VIEWPORT_MARGIN_PX - candidate.top) +
    Math.max(0, candidate.bottom - (height - VIEWPORT_MARGIN_PX));
  const siblingOverlap = siblingRects.reduce(
    (total, rect) => total + intersectionArea(candidate, rect),
    0,
  );
  return overflow * 100000 + siblingOverlap + preference;
}

function resetSmartDate(root) {
  root.removeAttribute("data-edge-smart-date-direction");
  root.removeAttribute("data-edge-smart-date-horizontal");
  root.removeAttribute("data-edge-smart-date-mode");
  const picker = root.querySelector(".edge-smart-date__picker");
  if (!picker) return;
  for (const property of ["position", "top", "bottom", "left", "right", "width", "max-height"]) {
    picker.style.removeProperty(property);
  }
}

function resetClosedSmartDates(documentObject) {
  documentObject
    .querySelectorAll(
      ".edge-smart-date[data-edge-smart-date-direction]:not(.is-open), " +
      ".edge-smart-date[data-edge-smart-date-mode]:not(.is-open)",
    )
    .forEach(resetSmartDate);
}

function positionSmartDate(root, globalObject) {
  if (!root?.classList?.contains("is-open")) return;
  const trigger = root.querySelector(".edge-smart-date__trigger");
  const picker = root.querySelector(".edge-smart-date__picker");
  if (!trigger || !picker) return;

  const width = viewportWidth(globalObject);
  const height = viewportHeight(globalObject);
  if (!width || !height) return;

  const rootRect = root.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  const availableViewportWidth = Math.max(0, width - VIEWPORT_MARGIN_PX * 2);
  const desiredWidth = Math.min(
    SMART_DATE_MAX_WIDTH_PX,
    availableViewportWidth,
    Math.max(triggerRect.width, picker.scrollWidth || picker.offsetWidth || SMART_DATE_MAX_WIDTH_PX),
  );
  const desiredHeight = Math.min(
    SMART_DATE_MAX_HEIGHT_PX,
    picker.scrollHeight || picker.offsetHeight || SMART_DATE_MAX_HEIGHT_PX,
  );

  const spaceBelow = Math.max(0, height - triggerRect.bottom - SMART_DATE_GAP_PX - VIEWPORT_MARGIN_PX);
  const spaceAbove = Math.max(0, triggerRect.top - SMART_DATE_GAP_PX - VIEWPORT_MARGIN_PX);

  if (
    Math.max(spaceAbove, spaceBelow) < SMART_DATE_MIN_USABLE_HEIGHT_PX ||
    availableViewportWidth < SMART_DATE_MIN_USABLE_WIDTH_PX
  ) {
    root.dataset.edgeSmartDateMode = "viewport";
    root.dataset.edgeSmartDateDirection = "viewport";
    root.dataset.edgeSmartDateHorizontal = "viewport";
    picker.style.position = "fixed";
    picker.style.left = `${VIEWPORT_MARGIN_PX}px`;
    picker.style.right = "auto";
    picker.style.top = `${VIEWPORT_MARGIN_PX}px`;
    picker.style.bottom = "auto";
    picker.style.width = `${availableViewportWidth}px`;
    picker.style.maxHeight = `${Math.max(0, height - VIEWPORT_MARGIN_PX * 2)}px`;
    return;
  }

  const startLeft = triggerRect.left;
  const endLeft = triggerRect.right - desiredWidth;
  const downTop = triggerRect.bottom + SMART_DATE_GAP_PX;
  const upTop = triggerRect.top - SMART_DATE_GAP_PX - desiredHeight;
  const siblings = smartDateSiblingRects(root);

  const candidates = [
    {
      horizontal: "start",
      direction: "down",
      left: startLeft,
      top: downTop,
      right: startLeft + desiredWidth,
      bottom: downTop + desiredHeight,
      preference: 0,
    },
    {
      horizontal: "end",
      direction: "down",
      left: endLeft,
      top: downTop,
      right: endLeft + desiredWidth,
      bottom: downTop + desiredHeight,
      preference: 1,
    },
    {
      horizontal: "start",
      direction: "up",
      left: startLeft,
      top: upTop,
      right: startLeft + desiredWidth,
      bottom: upTop + desiredHeight,
      preference: 2,
    },
    {
      horizontal: "end",
      direction: "up",
      left: endLeft,
      top: upTop,
      right: endLeft + desiredWidth,
      bottom: upTop + desiredHeight,
      preference: 3,
    },
  ];

  candidates.sort(
    (left, right) =>
      placementScore(left, siblings, width, height, left.preference) -
      placementScore(right, siblings, width, height, right.preference),
  );
  const placement = candidates[0];

  const maxLeft = Math.max(VIEWPORT_MARGIN_PX, width - VIEWPORT_MARGIN_PX - desiredWidth);
  const viewportLeft = Math.min(maxLeft, Math.max(VIEWPORT_MARGIN_PX, placement.left));
  const availableHeight = placement.direction === "up" ? spaceAbove : spaceBelow;
  const maxHeight = Math.min(SMART_DATE_MAX_HEIGHT_PX, availableHeight);

  root.dataset.edgeSmartDateMode = "anchored";
  root.dataset.edgeSmartDateDirection = placement.direction;
  root.dataset.edgeSmartDateHorizontal = placement.horizontal;

  picker.style.position = "absolute";
  picker.style.left = `${viewportLeft - rootRect.left}px`;
  picker.style.right = "auto";
  picker.style.width = `${desiredWidth}px`;
  picker.style.maxHeight = `${Math.max(0, maxHeight)}px`;

  if (placement.direction === "up") {
    const visibleHeight = Math.min(desiredHeight, maxHeight);
    picker.style.top = `${triggerRect.top - SMART_DATE_GAP_PX - visibleHeight - rootRect.top}px`;
  } else {
    picker.style.top = `${triggerRect.bottom + SMART_DATE_GAP_PX - rootRect.top}px`;
  }
  picker.style.bottom = "auto";
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
      documentObject.querySelectorAll(".edge-smart-date").forEach(resetSmartDate);
      delete globalObject[RUNTIME_KEY];
    },
  };

  globalObject[RUNTIME_KEY] = runtime;
  return runtime;
}

export default installDropdownViewportRuntime;
