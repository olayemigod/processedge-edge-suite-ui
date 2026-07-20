import { edgeIconMarkup } from "./icons";

function normalizedText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizedProduct(value) {
  return (
    String(value || "edgesuite")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "edgesuite"
  );
}

function sharedIdentity(product) {
  const boot = globalThis.frappe?.boot || {};
  const shared = boot.edgesuite_ui_identity || {};
  return shared[normalizedProduct(product)] || {};
}

function companyEntries(identity) {
  return Object.entries(identity.companies || {}).map(([key, value]) => ({
    key,
    label: normalizedText(value?.label || value?.name || key),
    logo: value?.logo || "",
  }));
}

function resolveCompany(identity, chipTexts) {
  const entries = companyEntries(identity);
  if (!entries.length) return null;
  for (const chipText of chipTexts) {
    const normalized = normalizedText(chipText);
    const match = entries.find(
      (entry) => normalizedText(entry.key) === normalized || entry.label === normalized,
    );
    if (match) return match;
  }
  return null;
}

function setText(element, value) {
  if (!element) return;
  const next = normalizedText(value);
  if (next && normalizedText(element.textContent) !== next) element.textContent = next;
}

function setImageOrIcon(mark, { logo = "", icon = "grid", label = "" } = {}) {
  if (!mark) return;
  const signature = `${logo}|${icon}|${label}`;
  if (mark.dataset.edgeContextIdentity === signature) return;
  mark.dataset.edgeContextIdentity = signature;
  mark.replaceChildren();
  mark.classList.toggle("edge-identity-mark--image", Boolean(logo));

  if (logo) {
    const image = document.createElement("img");
    image.className = "edge-identity-logo";
    image.src = logo;
    image.alt = label;
    image.loading = "eager";
    image.decoding = "async";
    mark.appendChild(image);
    return;
  }

  const iconNode = document.createElement("span");
  iconNode.className = "edge-icon edge-icon--sm";
  iconNode.setAttribute("aria-hidden", "true");
  iconNode.innerHTML = edgeIconMarkup(icon || "grid", { size: "sm" });
  mark.appendChild(iconNode);
}

function applyContextIdentity(shell) {
  const product = shell.getAttribute("data-edge-product") || "edgesuite";
  const identity = sharedIdentity(product);
  if (!identity?.companies || typeof identity.companies !== "object") return;

  const topbar = shell.querySelector(".edge-app-shell__topbar.edge-topbar");
  if (!topbar) return;
  const chips = [...topbar.querySelectorAll(".edge-topbar-context .edge-context-chip")];
  const company = resolveCompany(
    identity,
    chips.map((chip) => chip.textContent),
  );
  if (!company) return;

  identity.tenant_name = company.label || company.key;
  identity.tenant_logo = company.logo || "";

  const brand = topbar.querySelector(".edge-topbar__brand");
  setImageOrIcon(brand?.querySelector(".edge-topbar__mark"), {
    logo: company.logo || identity.tenant_logo || "",
    icon: identity.tenant_icon || "building",
    label: company.label || company.key,
  });
  setText(brand?.querySelector(".edge-topbar__title-copy strong"), identity.tenant_name);
  setText(
    brand?.querySelector(".edge-topbar__title-copy small"),
    identity.tenant_subtitle || "Workspace",
  );

  chips.forEach((chip) => {
    const text = normalizedText(chip.textContent);
    const isTenant =
      text === normalizedText(company.key) || text === normalizedText(company.label);
    chip.toggleAttribute("data-edge-tenant-chip", isTenant);
  });
}

function applyProductMenuIdentity() {
  const edgeUI = globalThis.EdgeSuiteUI || globalThis.EdgeUI;
  const config = edgeUI?.getProductMenuConfig?.();
  if (!config?.product) return;
  const identity = sharedIdentity(config.product);
  const productName = normalizedText(identity.product_name || identity.product_label);
  if (!productName) return;

  const panel = document.getElementById("edge-product-menu-dropdown");
  if (!panel) return;
  const brand = panel.querySelector(".edge-product-menu__brand");
  setImageOrIcon(brand?.querySelector(".edge-product-menu__brand-mark"), {
    logo: identity.product_logo || "",
    icon: identity.product_icon || "grid",
    label: productName,
  });
  setText(brand?.querySelector("strong"), productName);
  setText(brand?.querySelector("small"), identity.product_subtitle || config.subtitle || "EdgeSuite product");
  setText(panel.querySelector(".edge-product-menu__product"), productName);

  const input = panel.querySelector(".edge-product-menu__search");
  if (input) input.placeholder = `Search ${productName}`;
  panel.setAttribute("aria-label", `${productName} product menu`);
  const trigger = document.getElementById("edge-product-menu-trigger");
  if (trigger) trigger.setAttribute("aria-label", `Open ${productName} product menu`);
}

let observer = null;
let scheduled = false;

function applyAllContextIdentities() {
  scheduled = false;
  document
    .querySelectorAll(".edge-app-shell[data-edge-product]")
    .forEach((shell) => applyContextIdentity(shell));
  applyProductMenuIdentity();
}

function scheduleContextIdentity() {
  if (scheduled) return;
  scheduled = true;
  globalThis.requestAnimationFrame?.(applyAllContextIdentities) ||
    globalThis.setTimeout?.(applyAllContextIdentities, 0);
}

export function installContextIdentityResolver() {
  if (observer || typeof document === "undefined" || !document.body) return;
  observer = new MutationObserver(scheduleContextIdentity);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("page-change", scheduleContextIdentity);
  document.addEventListener("edgesuite-context-changed", scheduleContextIdentity);
  globalThis.frappe?.router?.on?.("change", scheduleContextIdentity);
  scheduleContextIdentity();
}

export { applyAllContextIdentities, applyContextIdentity, applyProductMenuIdentity };
