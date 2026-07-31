const QUICK_ACTION_SECTION_KEY = "quick-actions";
const DENSITY_CONTROL_CLASS = "edge-product-menu__density";

function normalizedQuickActions(config = {}) {
  const actions = Array.isArray(config.quick_actions)
    ? config.quick_actions
    : Array.isArray(config.quickActions)
      ? config.quickActions
      : [];
  const seen = new Set();
  return actions.filter((item) => {
    const identity = String(item?.route || item?.link_to || item?.label || "").trim();
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return item?.visible !== false && item?.hidden !== 1;
  });
}

function withQuickActions(config = {}) {
  const actions = normalizedQuickActions(config);
  if (!actions.length) return config;
  const sections = Array.isArray(config.sections) ? [...config.sections] : [];
  if (sections.some((section) => section?.key === QUICK_ACTION_SECTION_KEY)) return config;
  const overviewIndex = sections.findIndex((section) => section?.key === "overview");
  const insertAt = overviewIndex >= 0 ? overviewIndex + 1 : 0;
  sections.splice(insertAt, 0, {
    key: QUICK_ACTION_SECTION_KEY,
    label: "Quick Actions",
    description: "Frequently used actions available to your current role",
    icon: "bolt",
    items: actions,
  });
  return { ...config, sections };
}

function installDensityControl(runtime, target) {
  const document = target?.document;
  if (!document) return;
  const panel = document.getElementById("edge-product-menu-dropdown");
  if (!panel || panel.querySelector(`.${DENSITY_CONTROL_CLASS}`)) return;
  const searchWrap = panel.querySelector(".edge-product-menu__search-wrap");
  if (!searchWrap) return;

  const select = document.createElement("select");
  select.className = DENSITY_CONTROL_CLASS;
  select.setAttribute("aria-label", "Display density");
  for (const [value, label] of [
    ["compact", "Compact"],
    ["comfortable", "Comfortable"],
    ["touch", "Touch"],
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = runtime.getDensity?.() || "compact";
  select.addEventListener("change", () => runtime.setDensity?.(select.value));
  searchWrap.appendChild(select);
}

export function installProductMenuExtras(runtime, target = globalThis) {
  if (!runtime || runtime.__productMenuExtrasInstalled) return runtime;
  const originalRegister = runtime.registerProductMenu?.bind(runtime);
  if (!originalRegister) return runtime;

  let sourceConfig = null;
  runtime.registerProductMenu = function registerProductMenu(config) {
    sourceConfig = config && typeof config === "object" ? { ...config } : config;
    const registered = originalRegister(withQuickActions(config));
    target.requestAnimationFrame?.(() => installDensityControl(runtime, target));
    return registered;
  };
  runtime.getProductMenuSourceConfig = () => sourceConfig;

  const refreshExtras = () => installDensityControl(runtime, target);
  target.document?.addEventListener?.("page-change", refreshExtras);
  target.addEventListener?.("edgesuite:density-changed", refreshExtras);
  if (target.MutationObserver && target.document?.body) {
    const observer = new target.MutationObserver(refreshExtras);
    observer.observe(target.document.body, { childList: true, subtree: true });
    runtime.__productMenuExtrasObserver = observer;
  }

  runtime.__productMenuExtrasInstalled = true;
  return runtime;
}

export { DENSITY_CONTROL_CLASS, QUICK_ACTION_SECTION_KEY, withQuickActions };