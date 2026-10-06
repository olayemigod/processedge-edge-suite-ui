import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE_ROOT = ROOT / "edgesuite_ui" / "edgesuite_ui" / "page" / "edge_printing"
PAGE_JSON = PAGE_ROOT / "edge_printing.json"
PAGE_JS = PAGE_ROOT / "edge_printing.js"
PROFILE_PAGE_ROOT = ROOT / "edgesuite_ui" / "edgesuite_ui" / "page" / "edge_print_profiles"
PROFILE_PAGE_JSON = PROFILE_PAGE_ROOT / "edge_print_profiles.json"
PROFILE_PAGE_JS = PROFILE_PAGE_ROOT / "edge_print_profiles.js"
PROFILE_JSON = (
    ROOT
    / "edgesuite_ui"
    / "edgesuite_ui"
    / "doctype"
    / "edge_print_profile"
    / "edge_print_profile.json"
)
PRINTING_API = ROOT / "edgesuite_ui" / "api" / "printing.py"
CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_printing.css"
PROFILE_CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_print_profile_manager.css"
HOOKS = ROOT / "edgesuite_ui" / "hooks.py"


def test_devices_and_printing_page_is_a_standard_edgesuite_page():
    page = json.loads(PAGE_JSON.read_text())

    assert page["doctype"] == "Page"
    assert page["name"] == "edge-printing"
    assert page["page_name"] == "edge-printing"
    assert page["module"] == "EdgeSuite UI"
    assert page["title"] == "Devices & Printing"
    assert page["standard"] == "Yes"


def test_devices_and_printing_page_uses_edgesuite_page_primitives_and_shared_component():
    source = PAGE_JS.read_text()

    for expected in (
        'getComponent?.("EdgePrinterSetupCard")',
        'getComponent("EdgePrinterSetupCard")',
        "createEdgeApp",
        "edge-page-layout",
        "edge-page-header",
        "edge-page-header__title",
        "edge-page-header__subtitle",
        "edge-status-badge",
        "edge-button edge-button--secondary",
        "product_key",
        "company",
        "branch",
        "data-edge-suite-page",
        "Manage Print Profiles",
        "edgeUI.mountSharedPageShell",
        'globalThis.location.assign(pageUrl("edge-print-profiles"))',
    ):
        assert expected in source

    for forbidden in (
        "navigator.serial",
        "requestPort(",
        "ESC/POS",
        "RetailEdge",
        "VetEdge",
        "EduEdge",
        "Product: ${context.productKey}",
        'frappe.set_route("List", "Edge Print Profile")',
    ):
        assert forbidden not in source


def test_devices_and_printing_resolves_context_without_query_string_navigation():
    source = PAGE_JS.read_text()

    for expected in (
        "boot.edgesuite_ui_identity?.[key]",
        "identity.active_company",
        "identity.active_branch",
        'return `/app/${page}`;',
        'activeRoute: pageUrl("edge-printing")',
        "fallbackMenuItems: printingFallbackMenu()",
    ):
        assert expected in source

    assert 'params.set("company"' not in source
    assert 'params.set("branch"' not in source
    assert 'return `/app/${page}${query ? `?${query}` : ""}`;' not in source


def test_devices_and_printing_does_not_expose_internal_product_key_in_ui():
    source = PAGE_JS.read_text()

    assert "productKey: context.productKey" in source
    assert "Product:" not in source
    assert "Company:" in source
    assert "Branch:" in source


def test_devices_and_printing_page_has_edgesuite_card_and_responsive_styles():
    css = CSS.read_text()

    for expected in (
        ".edge-printing-page-root",
        ".edge-printing-page-actions",
        ".edge-printing-page-content",
        ".edge-printing-page-card",
        ".edge-printer-setup",
        "var(--edge-color-surface",
        "var(--edge-color-border",
        "var(--edge-radius-md",
        "var(--edge-shadow-sm",
        "@media (max-width: 48rem)",
        "@media (max-width: 30rem)",
    ):
        assert expected in css


def test_print_profiles_is_a_system_manager_edgesuite_page():
    page = json.loads(PROFILE_PAGE_JSON.read_text())

    assert page["doctype"] == "Page"
    assert page["name"] == "edge-print-profiles"
    assert page["page_name"] == "edge-print-profiles"
    assert page["module"] == "EdgeSuite UI"
    assert page["title"] == "Print Profiles"
    assert page["standard"] == "Yes"
    assert page["roles"] == [{"role": "System Manager"}]


def test_print_profile_manager_uses_edgesuite_ui_and_hides_technical_product_key():
    source = PROFILE_PAGE_JS.read_text()

    for expected in (
        "data-edge-suite-page",
        "edge-page-layout",
        "edge-page-header",
        "edge-card",
        "edge-input__control",
        "edge-checkbox__surface",
        "New Print Profile",
        "Create Print Profile",
        '"Product"',
        "No product selected (shared policy)",
        "Serial / Bluetooth · ESC/POS",
        "get_print_profile_manager_context",
        "search_print_scope_values",
        "save_print_profile",
        'product_key: ""',
        "edgeUI.mountSharedPageShell",
    ):
        assert expected in source

    assert "Product Key" not in source
    assert "retailedge" not in source.lower()
    assert 'frappe.set_route("List", "Edge Print Profile")' not in source
    assert "page.body.appendChild(chrome.root)" not in source


def test_print_profile_manager_backend_defaults_product_blank_and_requires_system_manager():
    source = PRINTING_API.read_text()

    for expected in (
        "_require_print_profile_manager",
        "System Manager permission is required to manage printer profiles.",
        "get_print_profile_manager_context",
        "search_print_scope_values",
        "save_print_profile",
        '"product_key": ""',
        '"purpose": "Receipt"',
        '"transport": "Serial"',
        '"protocol": "ESC/POS"',
    ):
        assert expected in source


def test_print_profile_storage_uses_friendly_product_label_even_if_internal_field_stays_stable():
    profile = json.loads(PROFILE_JSON.read_text())
    fields = {field["fieldname"]: field for field in profile["fields"]}

    assert fields["product_key"]["label"] == "Product"
    assert "default" not in fields["product_key"]
    assert "Required for Company or Branch profiles" in fields["product_key"]["description"]


def test_print_profile_manager_styles_are_loaded_and_responsive():
    hooks = HOOKS.read_text()
    css = PROFILE_CSS.read_text()

    assert "/assets/edgesuite_ui/css/edgeui_print_profile_manager.css" in hooks
    for expected in (
        ".edge-print-profiles-page-root",
        ".edge-print-profile-list-card",
        ".edge-print-profile-row",
        ".edge-print-profile-editor",
        ".edge-print-profile-grid--2",
        ".edge-print-profile-grid--3",
        ".edge-print-profile-capability",
        "@media (max-width: 48rem)",
        "@media (max-width: 30rem)",
    ):
        assert expected in css
