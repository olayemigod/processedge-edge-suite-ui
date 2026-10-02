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


def test_devices_and_printing_page_mounts_shared_component_only():
    source = PAGE_JS.read_text()

    for expected in (
        'getComponent?.("EdgePrinterSetupCard")',
        'getComponent("EdgePrinterSetupCard")',
        "createEdgeApp",
        "product_key",
        "company",
        "branch",
        'data-edge-suite-page',
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
    ):
        assert forbidden not in source


def test_devices_and_printing_page_has_responsive_shared_styles():
    css = CSS.read_text()

    for expected in (
        ".edge-printing-page-root",
        ".edge-printing-page-intro",
        ".edge-printing-page-context",
        ".edge-printing-page-card",
    ):
        assert expected in css
