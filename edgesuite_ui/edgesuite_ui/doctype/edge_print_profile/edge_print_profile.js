const SCOPE_DOCTYPES = {
  Global: "",
  Company: "Company",
  Branch: "Branch",
  User: "User",
};

function applyScopeDoctype(frm, { clearInvalid = false } = {}) {
  const scopeDoctype = SCOPE_DOCTYPES[frm.doc.scope_type] ?? "";
  const changed = frm.doc.scope_doctype !== scopeDoctype;
  frm.set_value("scope_doctype", scopeDoctype);
  if (frm.doc.scope_type === "Global") {
    frm.set_value("scope_value", "");
  } else if (clearInvalid && changed && frm.doc.scope_value) {
    frm.set_value("scope_value", "");
  }
}

function applyPaperDefault(frm) {
  const width = Number(frm.doc.paper_width || 0);
  const current = Number(frm.doc.characters_per_line || 0);
  if (width === 58 && (!current || current === 48)) {
    frm.set_value("characters_per_line", 32);
  } else if (width === 80 && (!current || current === 32)) {
    frm.set_value("characters_per_line", 48);
  }
}

async function loadProductOptions(frm) {
  const response = await frappe.call({
    method: "edgesuite_ui.api.product_context.get_product_context",
    type: "GET",
  });
  const products = response?.message?.available_products || [];
  const current = String(frm.doc.product_key || "").trim();
  const keys = products.map((row) => String(row.key || "").trim()).filter(Boolean);
  if (current && !keys.includes(current)) keys.push(current);
  frm.set_df_property("product_key", "options", keys);
  frm.refresh_field("product_key");
}

frappe.ui.form.on("Edge Print Profile", {
  setup(frm) {
    applyScopeDoctype(frm);
  },
  refresh(frm) {
    applyScopeDoctype(frm);
    loadProductOptions(frm).catch(() => {});
  },
  scope_type(frm) {
    applyScopeDoctype(frm, { clearInvalid: true });
  },
  paper_width(frm) {
    applyPaperDefault(frm);
  },
});
