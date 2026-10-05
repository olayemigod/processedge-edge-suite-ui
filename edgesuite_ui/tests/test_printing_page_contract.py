import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE_ROOT = ROOT / "edgesuite_ui" / "edgesuite_ui" / "page" / "edge_printing"
PAGE_JSON = PAGE_ROOT / "edge_printing.json"
PAGE_JS = PAGE_ROOT / "edge_printing.js"
CSS = ROOT / "edgesuite_ui" / "public" / "css" / "edgeui_printing.css"


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
    ):
        assert forbidden not in source


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
