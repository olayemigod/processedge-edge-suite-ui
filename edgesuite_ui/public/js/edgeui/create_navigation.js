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

export function canCreateDocument(doctype, { target = globalThis } = {}) {
  const normalized = normalizeDoctype(doctype);
  const checker = target.frappe?.model?.can_create;
  if (typeof checker !== "function") return true;
  return Boolean(checker(normalized));
}

export function openCreateSurface(
  doctype,
  { defaults = {}, initCallback = null, target = globalThis } = {},
) {
  const normalized = normalizeDoctype(doctype);
  const frappe = target.frappe;

  if (!frappe || typeof frappe.new_doc !== "function") {
    throw new Error("Frappe native document creation is unavailable.");
  }

  if (!canCreateDocument(normalized, { target })) {
    showPermissionMessage(target, normalized);
    return Promise.resolve(false);
  }

  const values = defaults && typeof defaults === "object" && !Array.isArray(defaults)
    ? { ...defaults }
    : {};

  // Frappe owns the create-surface decision:
  // - Quick Entry capable DocTypes open native Quick Entry first.
  // - DocTypes without Quick Entry fall through to the full Form.
  // - Native Quick Entry retains its built-in Edit Full Form action.
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
