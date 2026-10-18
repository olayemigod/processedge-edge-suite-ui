const HOST_ID = "edge-product-menu-host";
const TRIGGER_ID = "edge-product-menu-trigger";
const GLOBAL_ACTION_ID = "edge-product-global-action";
const PANEL_ID = "edge-product-menu-dropdown";

function userRoles(target) {
  const bootRoles = target?.frappe?.boot?.user?.roles;
  const sessionRoles = target?.frappe?.user_roles;
  return new Set([
    ...(Array.isArray(bootRoles) ? bootRoles : []),
    ...(Array.isArray(sessionRoles) ? sessionRoles : []),
  ]);
}

function actionIsVisible(target, action) {
  if (!action || action.visible === false || action.hidden === 1) return false;
  if (!Array.isArray(action.roles) || !action.roles.length) return true;
  const roles = userRoles(target);
  return action.roles.some((role) => roles.has(role));
}

function globalActionExpected(runtime, target) {
  const action = runtime?.getProductMenuConfig?.()?.global_action;
  return actionIsVisible(target, action);
}

export function installProductMenuGlobalActionRecovery(runtime, target = globalThis) {
  if (!runtime || runtime.__productMenuGlobalActionRecoveryInstalled) return runtime;
  const document = target?.document;
  if (!document) return runtime;

  let scheduled = false;

  const repair = () => {
    scheduled = false;
    const host = document.getElementById(HOST_ID);
    const trigger = document.getElementById(TRIGGER_ID);
    const panel = document.getElementById(PANEL_ID);
    if (!host || !trigger || !panel) return false;
    if (!globalActionExpected(runtime, target)) return false;
    if (document.getElementById(GLOBAL_ACTION_ID)) return true;

    runtime.refreshProductMenu?.();
    if (!document.getElementById(GLOBAL_ACTION_ID)) {
      runtime.mountProductMenu?.();
    }
    return Boolean(document.getElementById(GLOBAL_ACTION_ID));
  };

  const scheduleRepair = () => {
    if (scheduled) return;
    scheduled = true;
    const schedule = target.requestAnimationFrame || ((callback) => target.setTimeout?.(callback, 0));
    schedule?.(repair);
  };

  ["desktop_screen", "sidebar_setup", "toolbar_setup", "page-change"].forEach((eventName) => {
    document.addEventListener(eventName, scheduleRepair);
  });
  target.frappe?.router?.on?.("change", scheduleRepair);

  if (target.MutationObserver && document.body) {
    const observer = new target.MutationObserver(() => {
      if (!globalActionExpected(runtime, target)) return;
      if (document.getElementById(GLOBAL_ACTION_ID)) return;
      if (!document.getElementById(HOST_ID)) return;
      if (!document.getElementById(TRIGGER_ID)) return;
      if (!document.getElementById(PANEL_ID)) return;
      scheduleRepair();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    runtime.__productMenuGlobalActionRecoveryObserver = observer;
  }

  runtime.recoverProductMenuGlobalAction = repair;
  runtime.__productMenuGlobalActionRecoveryInstalled = true;
  scheduleRepair();
  return runtime;
}

export {
  GLOBAL_ACTION_ID,
  HOST_ID,
  PANEL_ID,
  TRIGGER_ID,
  actionIsVisible,
  globalActionExpected,
};
