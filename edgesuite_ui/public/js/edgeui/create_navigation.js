function normalizeDoctype(value) {
  const doctype = String(value || "").trim();
  if (!doctype) {
    throw new TypeError("EdgeSuite create navigation requires a DocType");
  }
  return doctype;
}

function normalizeName(value) {
  const name = String(value || "").trim();
  if (!name) {
    throw new TypeError("EdgeSuite document navigation requires a document name");
  }
  return name;
}

function showPermissionMessage(target, doctype) {
  const message = `You do not have permission to create ${doctype}.`;
  if (target.frappe?.msgprint) {
    target.frappe.msgprint({
      title: "Permission Required",
      message,
      indicator: "orange",
    });
  } else {
    target.console?.warn?.(message);
  }
}

function restrictedToEdgeSuite(target) {
  return target.frappe?.boot?.edgesuite_ui_access?.mode === "edgesuite_only";
}

function showRestrictedMessage(target) {
  const message = "This account is limited to EdgeSuite operational pages.";
  if (target.frappe?.msgprint) {
    target.frappe.msgprint({
      title: "EdgeSuite Access",
      message,
      indicator: "orange",
    });
  } else {
    target.console?.warn?.(message);
  }
}

export function canCreateDocument(doctype, { target = globalThis } = {}) {
  const normalized = normalizeDoctype(doctype);
  const checker = target.frappe?.model?.can_create;
  if (typeof checker !== "function") return true;
  return Boolean(checker(normalized));
}

export function openCreateSurface(
  doctype,
  {
    defaults = {},
    initCallback = null,
    allowRestricted = false,
    target = globalThis,
  } = {},
) {
  const normalized = normalizeDoctype(doctype);
  const frappe = target.frappe;

  if (!frappe || typeof frappe.new_doc !== "function") {
    throw new Error("Frappe native document creation is unavailable.");
  }

  if (restrictedToEdgeSuite(target) && !allowRestricted) {
    showRestrictedMessage(target);
    return Promise.resolve(false);
  }

  if (!canCreateDocument(normalized, { target })) {
    showPermissionMessage(target, normalized);
    return Promise.resolve(false);
  }

  const values =
    defaults && typeof defaults === "object" && !Array.isArray(defaults) ? { ...defaults } : {};

  // EdgeSuite-only callers must opt in explicitly after the product has
  // established an appropriate containment policy for any native Form escape.
  //
  // Frappe owns the creation-surface decision. In Frappe v16, frappe.new_doc()
  // honors a DocType create route when present, otherwise opens native Quick
  // Entry when supported and falls through to the full Form when it is not.
  return Promise.resolve(
    frappe.new_doc(
      normalized,
      values,
      typeof initCallback === "function" ? initCallback : undefined,
    ),
  ).then(() => true);
}

export function openExistingDocument(
  doctype,
  name,
  { target = globalThis } = {},
) {
  const normalizedDoctype = normalizeDoctype(doctype);
  const normalizedName = normalizeName(name);
  const setRoute = target.frappe?.set_route;

  if (typeof setRoute !== "function") {
    throw new Error("Frappe document routing is unavailable.");
  }

  // Existing documents always use the persistent Form surface.
  return setRoute("Form", normalizedDoctype, normalizedName);
}
