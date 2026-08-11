(() => {
  const THEME_EVENT = "edgesuite:theme-changed";
  const AUTO_CLASS = "edge-theme-menu__auto-schedule";

  function themeController() {
    return globalThis.EdgeUI?.theme || globalThis.EdgeSuiteUI?.theme || null;
  }

  function updatePressedState(menu, preference) {
    menu.querySelectorAll(".edge-theme-menu__choices .edge-theme-menu__choice").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.value === preference.appearance ? "true" : "false");
    });
    menu.querySelectorAll(".edge-theme-menu__palette-list .edge-theme-menu__choice").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.value === preference.palette ? "true" : "false");
    });
  }

  function updateStatus(menu, preference, resolvedAppearance) {
    const status = menu.querySelector(".edge-theme-menu__status");
    if (!status) return;
    status.textContent = preference.appearance === "auto"
      ? `Auto · ${resolvedAppearance} now`
      : preference.appearance === "system"
        ? `System · ${resolvedAppearance} now`
        : `${resolvedAppearance} appearance`;
  }

  function makeTimeField(document, labelText, value) {
    const label = document.createElement("label");
    label.className = "edge-theme-menu__time-field";
    const copy = document.createElement("span");
    copy.textContent = labelText;
    const input = document.createElement("input");
    input.type = "time";
    input.value = value;
    input.className = "edge-theme-menu__time-input";
    label.append(copy, input);
    return { label, input };
  }

  function syncAutoSchedule(menu, controller, preference) {
    const existing = menu.querySelector(`.${AUTO_CLASS}`);
    if (preference.appearance !== "auto") {
      existing?.remove();
      return;
    }

    if (existing) {
      const inputs = existing.querySelectorAll("input[type='time']");
      if (inputs[0] && inputs[0] !== globalThis.document?.activeElement) inputs[0].value = preference.autoLightStart;
      if (inputs[1] && inputs[1] !== globalThis.document?.activeElement) inputs[1].value = preference.autoDarkStart;
      return;
    }

    const document = menu.ownerDocument;
    const section = document.createElement("div");
    section.className = `edge-theme-menu__section ${AUTO_CLASS}`;

    const heading = document.createElement("span");
    heading.className = "edge-theme-menu__label";
    heading.textContent = "Auto schedule";

    const fields = document.createElement("div");
    fields.className = "edge-theme-menu__time-fields";
    const light = makeTimeField(document, "Light from", preference.autoLightStart);
    const dark = makeTimeField(document, "Dark from", preference.autoDarkStart);

    const commit = () => {
      controller.setAutoSchedule({
        lightStart: light.input.value,
        darkStart: dark.input.value,
      });
    };
    light.input.addEventListener("change", commit);
    dark.input.addEventListener("change", commit);
    fields.append(light.label, dark.label);
    section.append(heading, fields);

    const status = menu.querySelector(".edge-theme-menu__status");
    menu.insertBefore(section, status || null);
  }

  function syncMenu() {
    const menu = globalThis.document?.querySelector?.(".edge-theme-menu");
    const controller = themeController();
    if (!menu || !controller) return;
    const preference = controller.getPreference();
    updatePressedState(menu, preference);
    updateStatus(menu, preference, controller.getResolvedAppearance());
    syncAutoSchedule(menu, controller, preference);
  }

  const observer = globalThis.MutationObserver && globalThis.document?.body
    ? new globalThis.MutationObserver((records) => {
        if (records.some((record) => record.addedNodes?.length || record.removedNodes?.length)) syncMenu();
      })
    : null;

  observer?.observe(globalThis.document.body, { childList: true, subtree: true });
  globalThis.addEventListener?.(THEME_EVENT, syncMenu);
  globalThis.document?.addEventListener?.("page-change", syncMenu);
  syncMenu();
})();
