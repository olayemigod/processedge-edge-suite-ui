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

function setMark(mark, identity, company) {
  if (!mark || !company) return;
  const logo = company.logo || identity.tenant_logo || "";
  const signature = `${logo}|${company.label}|${identity.tenant_icon || "building"}`;
  if (mark.dataset.edgeContextIdentity === signature) return;
  mark.dataset.edgeContextIdentity = signature;
  mark.replaceChildren();
  mark.classList.toggle("edge-identity-mark--image", Boolean(logo));

  if (logo) {
    const image = document.createElement("img");
    image.className = "edge-identity-logo";
    image.src = logo;
    image.alt = company.label || company.key;
    image.loading = "eager";
    image.decoding = "async";
    mark.appendChild(image);
    return;
  }

  const icon = document.createElement("span");
  icon.className = "edge-icon edge-icon--sm";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = edgeIconMarkup(identity.tenant_icon || "building", { size: "sm" });
  mark.appendChild(icon);
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
  setMark(brand?.querySelector(".edge-topbar__mark"), identity, company);
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

let observer = null;
let scheduled = false;

function applyAllContextIdentities() {
  scheduled = false;
  document
    .querySelectorAll(".edge-app-shell[data-edge-product]")
    .forEach((shell) => applyContextIdentity(shell));
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

export { applyAllContextIdentities, applyContextIdentity };
