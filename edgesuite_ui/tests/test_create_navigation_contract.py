from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]


def test_native_create_navigation_uses_frappe_authority():
    source = (APP_ROOT / "public/js/edgeui/create_navigation.js").read_text(encoding="utf-8")

    assert "frappe.new_doc" in source
    assert "target.frappe?.model?.can_create" in source
    assert 'setRoute("Form", normalizedDoctype, normalizedName)' in source
    assert "make_quick_entry" not in source

    for forbidden in ("Customer", "Supplier", "Item", "Sales Invoice", "Purchase Invoice"):
        assert forbidden not in source


def test_runtime_exposes_create_and_existing_document_navigation():
    runtime = (APP_ROOT / "public/js/edgeui/runtime.js").read_text(encoding="utf-8")
    bundle = (APP_ROOT / "public/js/edgeui.bundle.js").read_text(encoding="utf-8")

    assert "openCreateSurface(doctype, options = {})" in runtime
    assert "openExistingDocument(doctype, name, options = {})" in runtime
    assert 'export * from "./edgeui/create_navigation"' in bundle


def test_product_menu_supports_explicit_create_intent():
    source = (APP_ROOT / "public/js/edgeui/product_menu_v2.js").read_text(encoding="utf-8")

    assert 'intent: String(item.intent || item.action || "").trim().toLowerCase()' in source
    assert 'item?.link_type === "DocType" && item?.intent === "create"' in source
    assert "target.EdgeSuiteUI?.openCreateSurface" in source
    assert 'data-intent="${escapeHtml(item.intent)}"' in source
    navigator = source.index("if (config?.navigate)")
    shared_create = source.index('item?.link_type === "DocType" && item?.intent === "create"')
    assert navigator < shared_create


def test_create_contract_is_documented():
    docs = (APP_ROOT.parent / "docs/professional-shell-and-menu.md").read_text(encoding="utf-8")

    assert "Native create navigation" in docs
    assert "openCreateSurface" in docs
    assert "frappe.new_doc" in docs
    assert "Edit Full Form" in docs
